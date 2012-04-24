define(function() {

    function errorWrapper(callback) {
        return function(err) {
            console.error('Error occurred', err);
            callback(err);
        }
    }

    function LocalFile(path) {
        this.path = path;
    }
    _.extend(LocalFile.prototype, {
        open: function(callback) {
            var self = this;
            LocalFile._fs.root.getFile(self.path, {
                create: true,
                exclusive: false // Don't throw error if the file exists
            }, function(fileEntry) {
                self._fd = fileEntry;
                callback(null, self);
            }, errorWrapper(callback));
        },
        shortlink: function(callback) {
            callback("nope");
        },
        read: function(callback) {
            var self = this;
            self.open(function(err) {
                if (err) {
                    callback(err);
                }
                self._fd.file(function(file) {
                    var reader = new FileReader();
                    reader.onloadend = function(e) {
                        callback(null, reader.result);
                    }
                    reader.readAsText(file);
                }, errorWrapper(callback));
            });
        },
        write: function(contents, callback) {
            var self = this;
            // We always entirely overwrite the file, so delete the file
            // open it, and then write it.
            self.open(function(err) {
                if (err) {
                    callback(err);
                }
                self.del(function(err) {
                    if (err) {
                        callback(err);
                    }
                    self.open(function(err) {
                        if (err) {
                            callback(err);
                        }
                        self._fd.createWriter(function(writer) {
                            writer.onwriteend = function(e) {
                                callback(null, e);
                            }
                            writer.onerror = errorWrapper(callback);

                            var bb = new (window.BlobBuilder || window.WebKitBlobBuilder)();
                            bb.append(contents);
                            writer.write(bb.getBlob('text/plain'));
                        }, errorWrapper(callback));
                    });
                });
            });
        },
        del: function(callback) {
            this._fd.remove(function() {
                callback();
            }, errorWrapper(callback));
        },
        close: function(callback) {}
    });

    // 'Class' properties
    _.extend(LocalFile, {
        supported: function() {
            return !!window.webkitStorageInfo;
        },
        initialize: function(callback) {
            webkitStorageInfo.requestQuota(PERSISTENT, 5 * 1024 * 1024 /* 5MB */, function(grantedBytes) {
                if (grantedBytes === 0) {
                    callback(new Error('No bytes granted'));
                    return;
                }
                webkitRequestFileSystem(PERSISTENT, grantedBytes, function(fs) {
                    console.log('fs with %d bytes opened', grantedBytes);
                    LocalFile._fs = fs;
                    callback();
                }, function(err) {
                    callback(err);
                });
            }, function(err) {
                callback(err);
            });
        }
    });
    function LocalDirectory(path) {
        this.path = path;
    }
    _.extend(LocalDirectory.prototype, {
        _ensureDir: function(callback) {
            var self = this;
            LocalFile._fs.root.getDirectory(this.path, {}, function(dir) {
                self.dir = dir;
                self.reader = self.dir.createReader();
                callback();
            });
        },
        // Everything is terrible, so you have to call _readentries repeatedly
        // until it stops returning results.
        _readEntries: function(callback) {
            this.reader.readEntries(function(results) {
                callback(results);
            });
        },
        ls: function(callback) {
            var self = this;
            self._ensureDir(function() {
                var results = [];
                self._readEntries(function appender(entries) {
                    _.each(entries, function(entry) {
                        var result = {
                            name: entry.name,
                            path: entry.fullPath,
                        };
                        if (entry.isFile) {
                            _.extend(result, {
                                reader: LocalFile,
                                type: 'file'
                            });
                        } else if (entry.isDirectory) {
                            _.extend(result, {
                                reader: LocalDirectory,
                                type: 'dir'
                            });
                        }
                        results.push(result);
                    });
                    if (entries.length) {
                        self._readEntries(appender);
                    } else {
                        callback(null, results);
                    }
                });
            });
        },
        mkdir: function(name, callback) {
            var self = this;
            self._ensureDir(function() {
                self.dir.getDirectory(name, { create: true }, function(dir) {
                    callback(dir);
                }, errorWrapper(callback));
            });
        },
        touch: function(name, callback) {
            var path = this.path + '/' + name;
            var file = new LocalFile(path);
            file.open(callback);
        }
    });

    return {
        File: LocalFile,
        Directory: LocalDirectory
    };
});

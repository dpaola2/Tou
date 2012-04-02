(function($, _) {
    var setup_controls = function () {
        if (LocalFile.supported()) {
            LocalFile.initialize(function(err) {
                if (!err) {
                    $('.controls .open').show();
                }
            });
        }
    }

    var hookup_controls = function () {
        $('.controls .open').on('click', open_file);
        $('.controls .save').on('click', save_file);
    }

    var open_file = function() {
        var file = new LocalFile('the_only_file.md');
        file.read(function(err, contents) {
            $('.editor textarea').val(contents);
            focus_editor();
            convert();
            file.close(doNothing);
        });
    }

    var save_file = function() {
        var file = new LocalFile('the_only_file.md');
        file.write($('.editor textarea').val(), function(err) {
            file.close(doNothing);
        });
    }

    var focus_editor = function() {
        $('.editor textarea').focus();
    }

    var convert = function() {
        raw_input = $('.editor textarea').val();
        content = markdown.toHTML(raw_input);
        $('.preview').html(content);
    }

    var start_converting = function() {
        $('.editor textarea').on('input', convert);
    }

    var load_content = function(content) {
        $('.editor textarea').val(content);
        convert();
    }

    var load_file = function(url) {
        $.ajax({
            url: "/load_file",
            data: {url: url},
            success: function(data, textStatus, jqxhr) { load_content(data); }, 
            error: function(jqxhr, textStatus, errorThrown) { load_content(textStatus); }
        });
    }

    var load_readme = function() {
        $.ajax({
            url: "/readme",
            success: function(data, textStatus, jqxhr) { load_content(data); },
            error: function(jqxhr, textStatus, errorThrown) { load_content(textStatus); }
        });
    }

    var setup = function() {
        setup_controls();
        hookup_controls();
        focus_editor();
        start_converting();
        load_readme();
    }

    $(setup);

    function doNothing() {}

    function errorWrapper(callback) {
        return function(err) {
            console.error('Error occurred', err);
            callback(err);
        }
    }
    // Hoping to make this a general file read/write API that works for both
    // dropbox and local files. Starting with local files though.
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
                callback();
            }, errorWrapper(callback));
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
})(jQuery, _);

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

    var stop_event = function(e) {
        e.stopPropagation();
        e.preventDefault();
    }

    var hookup_controls = function () {
        $('.controls .open').on('click', open);
        $('.controls .save').on('click', save_file);

        // DnD support. jquery doesn't handle this well, so using
        // the old-school addEventListener.
        var dropEl = $('body')[0];
        if (dropEl.addEventListener) {
            dropEl.addEventListener('dragenter', show_drop_screen);
            dropEl.addEventListener('dragexit', hide_drop_screen);
            dropEl.addEventListener('dragover', stop_event);
            dropEl.addEventListener('drop', upload_file);
        }
    }

    var open_file = function(e) {
        var file = new LocalFile($.data(e.target, 'path'));
        file.read(function(err, contents) {
            reset_editor(contents);
            $('.tree').hide();
            $('.app').show();
            file.close(doNothing);
        });
    }

    var open = function() {
        var dir = new LocalDirectory();
        $('.app').hide();
        $('.tree').show();
        dir.ls(function(entries) {
            var $dir = $('<div class="dir" />');
            _.each(entries, function(entry) {
                var $dirEntry = $('<a href="#" class="entry" />')
                    .text(entry.name)
                    .data('path', entry.fullPath)
                    .on('click', open_file);
                $dir.append($dirEntry);
            });
            $('.tree').append($dir);
        });
    }

    var save_file = function() {
        var file = new LocalFile('the_only_file.md');
        file.write($('.editor textarea').val(), function(err) {
            file.close(doNothing);
        });
    }

    var upload_file = function(e) {
        hide_drop_screen(e);
        var files = e.dataTransfer.files;
        if (files.length) {
            var file = files[0];
            var reader = new FileReader();
            reader.onload = function(e) {
                reset_editor(e.target.result);
            };
            reader.readAsText(file);
        }
    }

    var show_drop_screen = function(e) {
        $('.drop-screen').show();
        stop_event(e);
    }

    var hide_drop_screen = function(e) {
        $('.drop-screen').hide();
        stop_event(e);
    }

    var reset_editor = function(new_contents) {
        $('.editor textarea').val(new_contents);
        focus_editor();
        convert();
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

    function LocalDirectory() {
        this.reader = LocalFile._fs.root.createReader(); // TODO: figure out how this should actually work
    }
    _.extend(LocalDirectory.prototype, {
        // Everything is terrible, so you have to call _readentries repeatedly
        // until it stops returning results.
        _readEntries: function(callback) {
            this.reader.readEntries(function(results) {
                callback(results);
            });
        },
        ls: function(callback) {
            var self = this;
            var results = [];
            self._readEntries(function appender(entries) {
                _.each(entries, function(entry) {
                    results.push(entry);
                });
                if (entries.length) {
                    self._readEntries(appender);
                } else {
                    callback(results);
                }
            });
        }
    });
})(jQuery, _);

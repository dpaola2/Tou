(function($, _) {
    // This is an instance of File class that can be written
    var current_file;
    var current_dir;

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
        $('.controls .mkdir').on('click', _.bind(new_file_prompt, null, 'dir'));
        $('.controls .touch').on('click', _.bind(new_file_prompt, null, 'file'));

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

    var open_dropbox_file = function(filename) {
        $.ajax({
            url: '/load_dropbox_file',
            type: 'get',
            data: {
                filepath: filename
            },
            success: function(data, textStatus, jqxhr) { reset_editor(data); }, 
            error: function(jqxhr, textStatus, errorThrown) { reset_editor(textStatus); }
        });
    }

    var open_file = function(file) {
        file.read(function(err, contents) {
            current_file = file;
            reset_editor(contents);
            hide_dir_tree();
            file.close(doNothing);
        });
    }

    var open = function() {
        show_dir_tree();
        render_dir(new ServiceDirectory());
    }

    var render_dir = function(dir) {
        dir.ls(function(entries) {
            var $dir = $('<ul class="dir" />');
            _.each(entries, function(entry) {
                var $dirEntry = $('<li class="entry" />')
                    .text(entry.name)
                    .data('meta', entry)
                    .on('click', descend);
                $dir.append($dirEntry);
            });
            $('.tree').append($dir);
        });
    }

    var descend = function(e) {
        var entry = $.data(e.target, 'meta');
        if (entry.type === 'dir') {
            var dir = new entry.reader(entry.path);
            current_dir = dir;
            return render_dir(dir);
        } else if (entry.type === 'file') {
            var file = new entry.reader(entry.path);
            return open_file(file);
        }
    }

    var show_dir_tree = function() {
        $('.app').hide();
        $('body').append('<div class="tree" />');
        $('.controls .edit').hide();
        $('.controls .dir').show();
    }

    var hide_dir_tree = function() {
        $('.app').show();
        $('.tree').remove();
        $('.controls .edit').show();
        $('.controls .dir').hide();
    }

    var save_file = function() {
        if (!current_file) {
        }
        current_file.write($('.editor textarea').val(), function(err) {
            current_file.close(doNothing);
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

    var new_file_prompt = function(type, e) {
        $input = $('<input type="text" />')
            .on('keyup', function(e) {
                if (e.which === 13) {
                    create_file(type, $input.val());
                }
            });
        $('.tree .dir').last().append($input);
        $input.focus();
    }

    var create_file = function(type, name) {
        if (type == 'file') {
            current_dir.touch(name, function(err, file) {
                hide_dir_tree();
                current_file = file;
                reset_editor('');
            });
        } else if (type == 'dir') {
            current_dir.mkdir(name, function(err) {
                $('.tree .dir').last().remove();
                render_dir(current_dir);
            });
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

    var load_file = function(url) {
        $.ajax({
            url: "/load_file",
            data: {url: url},
            success: function(data, textStatus, jqxhr) { reset_editor(data); }, 
            error: function(jqxhr, textStatus, errorThrown) { reset_editor(textStatus); }
        });
    }

    var load_readme = function() {
        $.ajax({
            url: "/readme",
            success: function(data, textStatus, jqxhr) { reset_editor(data); },
            error: function(jqxhr, textStatus, errorThrown) { reset_editor(textStatus); }
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
                callback(null, self);
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
                        callback(results);
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

    function ServiceDirectory() {}
    _.extend(ServiceDirectory.prototype, {
        ls: function(callback) {
            var services = [];
            if (LocalFile.supported()) {
                services.push({ name: 'Local', type: 'dir', reader: LocalDirectory });
            }
            /* services.push({ name: 'Dropbox', path: '/dropbox', type: 'dir', reader: DropboxDirectory }); */
            callback(services);
        }
    });
})(jQuery, _);

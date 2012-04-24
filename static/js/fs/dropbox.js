define(function() {
    function DropboxDirectory(path) {
        this.path = path;
    }
    _.extend(DropboxDirectory.prototype, {
        shortlink: function(callback) {
            $.ajax({
                url: '/dropbox/share',
                type: 'get',
                data: {
                    filepath: this.path
                },
                success: function(data, textStatus, jqxhr) { callback(null, data); },
                error: function(jqxhr, textStatus, errorThrown) { callback(textStatus); }
            });
        },
        read: function(callback) {
            $.ajax({
                url: '/dropbox/read',
                type: 'get',
                data: {
                    filepath: this.path
                },
                success: function(data, textStatus, jqxhr) { callback(null, data); }, 
                error: function(jqxhr, textStatus, errorThrown) { callback(textStatus); }
            });
        },
        close: function(callback) { console.log("dropbox close"); }, // TODO
        open: function(callback) { 
            var self = this;
            this.write("", callback);
        },
        del: function(callback) { console.log("dropbox del"); }, // TODO
        write: function(contents, callback) {
            var self = this;
            $.ajax({
                url: '/dropbox/save',
                type: 'post',
                data: {
                    filepath: self.path,
                    contents: contents
                },
                success: function(data, textStatus, jqxhr) { callback(null, data); }, 
                error: function(jqxhr, textStatus, errorThrown) { callback(textStatus); }
            });
        }, //TODO
        ls: function(callback) {
            var results = [];
            $.ajax({
                url: '/dropbox/ls',
                type: 'get',
                data: { dir: this.path || '/' },
                dataType: 'json',
                success: function(data, textStatus, jqxhr) {
                    _.each(data, function(entry) {
                        entry.reader = DropboxDirectory
                        if (entry.isFile) {
                            entry.type = 'file';
                        }
                        if (entry.isDirectory) {
                            entry.type = 'dir';
                        }
                    });

                    callback(null, data);
                },
                error: function(jqxhr, textStatus, errorThrown) {
                    console.error(textStatus);
                    callback(textStatus);
                }
            });
        },
        touch: function(name, callback) {
            var self = this;
            var fullpath = null;
            if (self.path === "/" || self.path === undefined) {
                fullpath = "/" + name;
            } else {
                fullpath = self.path + "/" + name;
            }
            var file = new DropboxDirectory(fullpath);
            file.open(function() {
                callback(null, file);
            });
        },
        mkdir: function(name, callback) {
            var self = this;
            var fullpath = null;
            if (self.path === "/" || self.path === undefined) {
                fullpath = "/" + name;
            } else {
                fullpath = self.path + "/" + name;
            }
            $.ajax({
                url: '/dropbox/mkdir',
                type: 'post',
                data: { path: fullpath },
                success: function(data, textStatus, jqxhr) {
                    self.path = fullpath;
                    callback(null);
                },
                error: function(jqxhr, textStatus, errorThrown) {
                    console.log(errorThrown);
                    callback(errorThrown);
                }
            });
        }
    });

    return {
        Directory: DropboxDirectory,
        File: DropboxDirectory
    };
});

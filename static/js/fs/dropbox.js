define(function() {
    function DropboxDirectory(path) {
        this.path = path;
    }
    _.extend(DropboxDirectory.prototype, {
        read: function(callback) {
            console.log("dropbox read");
            $.ajax({
                url: '/load_dropbox_file',
                type: 'get',
                data: {
                    filepath: this.path
                },
                success: function(data, textStatus, jqxhr) { callback(null, data); }, 
                error: function(jqxhr, textStatus, errorThrown) { callback(textStatus); }
            });
        },
        close: function(callback) { console.log("dropbox close"); }, // TODO
        open: function(callback) { console.log("dropbox open"); }, // TODO
        del: function(callback) { console.log("dropbox del"); }, // TODO
        write: function(contents, callback) {
            console.log("dropbox write");
            $.ajax({
                url: '/dropbox_save',
                type: 'post',
                data: {
                    filepath: this.path,
                    contents: contents
                },
                success: function(data, textStatus, jqxhr) { callback(null, data); }, 
                error: function(jqxhr, textStatus, errorThrown) { callback(textStatus); }
            });
        }, //TODO
        ls: function(callback) {
            console.log("dropbox ls");
            var results = [];
            $.ajax({
                url: '/dropbox_ls',
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

                    callback(data);
                },
                error: function(jqxhr, textStatus, errorThrown) { console.error(textStatus); }
            });
        },
        touch: function() {
            console.error('dropbox touch not implemented');
        },
        mkdir: function() {
            console.error('dropbox mkdir not implemented');
        }
    });

    return {
        Directory: DropboxDirectory,
        File: DropboxDirectory
    };
});

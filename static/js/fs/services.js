define(['./dropbox', './local'], function(dropbox, local) {
    function DropboxLinker() {}
    _.extend(DropboxLinker.prototype, {
        read: function(callback) {
            // TODO: do this by ajax, not redirects
            window.location.pathname = '/dropbox/link';
        }
    });

    function get_dropbox_service_entry() {
        var dbSession = sessions.dropbox;
        // TODO: resolve multiple users, 403 errors
        /*
        if (!dbSession) {
            dbSession = localStorage.getItem('dropboxSession');
        } else {
            localStorage.setItem('dropboxSession', dbSession);
        }*/
        if (dbSession) {
            return { name: 'Dropbox', type: 'dir', reader: dropbox.Directory };
        } else {
            return { name: 'Link Dropbox', type: 'file', reader: DropboxLinker };
        }
    }

    function ServiceDirectory() {}
    _.extend(ServiceDirectory.prototype, {
        ls: function(callback) {
            var services = [];
            services.push(get_dropbox_service_entry());
            if (local.File.supported()) {
                local.File.initialize(function(err) {
                    if (!err) {
                        services.push({ name: 'Local', type: 'dir', reader: local.Directory });
                    }
                    callback(null, services);
                });
            } else {
                callback(null, services);
            }
        }
    });

    return {
        Directory: ServiceDirectory
    };
});

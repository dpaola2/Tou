define(['./dropbox', './local'], function(dropbox, local) {
    function ServiceDirectory() {}
    _.extend(ServiceDirectory.prototype, {
        ls: function(callback) {
            var services = [];
            //TODO: determine if dropbox is supported
            services.push({ name: 'Dropbox', type: 'dir', reader: dropbox.Directory });
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

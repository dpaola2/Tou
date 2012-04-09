require.config({
    baseUrl: "/static/js",
    paths: {
        ace: 'lib/ace'
    }
});

$(function() {
    require(['application', 'ace/ace', '/static/js/lib/markdown.js'], function(app, ace) {
        window.ace = ace;
        app();
    });
});

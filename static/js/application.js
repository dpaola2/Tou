define(['fs/services', 'static/js/lib/spin.js'], function(services, local) {
    // This is an instance of File class that can be written
    var current_file;
    var current_dir;
    var $current_dir; // the dom node that represents the current directory

    // a spinner for indicating loading
    // options here: http://fgnass.github.com/spin.js/#?lines=12&length=5&width=2&radius=5&rotate=5&trail=60&speed=1.2&hwaccel=on
    var spinner = new Spinner({
        lines: 12,
        length: 5,
        width: 2,
        radius: 5,
        rotate: 5,
        trail: 60,
        speed: 1.2,
        hwaccel: false
    });

    // The ace editor
    var editor;

    function doNothing() {}

    var stop_event = function(e) {
        e.stopPropagation();
        e.preventDefault();
    }

    var hookup_controls = function () {

        $('#controls .open').on('click', open);
        $('#controls .save').on('click', save_file);
        $('#controls .mkdir').on('click', _.bind(new_file_prompt, null, 'dir'));
        $('#controls .touch').on('click', _.bind(new_file_prompt, null, 'file'));
        $('#controls .cancel').on('click', hide_dir_tree);
        $('#controls .shortlink').on('click', shortlink);
        var editor_div = $('#editor')[0];
        editor = ace.edit(editor_div);
        editor.setTheme('ace/theme/textmate');
        editor.setHighlightActiveLine(false);
        editor.renderer.setShowGutter(false);
        editor.getSession().setUseWrapMode(true);
        require(['ace/mode/markdown'], function(mode) {
            editor.getSession().setMode(new mode.Mode());
        });
        editor.setShowPrintMargin(false);
        editor.commands.removeCommand('gotoline'); // uses CTRL/CMD-L which is annoying

        // DnD support. jquery doesn't handle this well, so using
        // the old-school addEventListener.
        var dropEl = $('body')[0];
        if (dropEl.addEventListener) {
            dropEl.addEventListener('dragenter', show_drop_screen);
            dropEl.addEventListener('dragexit', hide_drop_screen);
            dropEl.addEventListener('dragover', stop_event);
            dropEl.addEventListener('drop', upload_file);
        }

        $(window).resize(size);
    }

    var open_file = function(file) {
        hide_dir_tree();
        show_blocking_notification('Opening&hellip;');
        file.read(function(err, contents) {
            current_file = file;
            reset_editor(contents);
            hide_blocking_notification();
            file.close(doNothing);
        });
    }

    var shortlink = function() {
        current_file.shortlink(function(err, contents) {
            alert(contents);
        });
    }

    var open = function() {
        show_dir_tree();
        render_dir(new services.Directory());
    }

    var render_dir = function(dir) {
        var $tree = $('.tree');
        spinner.spin();
        $tree.width(($tree.find('.dir').length + 1) * 301);
        $('.tree-scroller').animate({
            scrollLeft: $tree.width()
        }, {
            duration: 300
        });
        $tree.append(spinner.el);
        dir.ls(function(err, entries) {
            if (err) {
                //TODO: tell the user there was a problem
                console.error(err);
                return;
            }
            var $dir = $('<ul class="dir" />');
            _.each(entries, function(entry) {
                var $dirEntry = $('<li class="entry" />')
                    .text(entry.name)
                    .attr('title', entry.name)
                    .data('meta', entry)
                    .on('click', descend);
                $dir.append($dirEntry);
            });
            spinner.stop();
            $tree.append($dir);
            $current_dir = $dir;
        });
    }

    var descend = function(e) {
        var entry = $.data(e.target, 'meta');
        var $file = $(e.target);
        var $parent = $file.parent('.dir')
        $('.selected.current').removeClass('current');
        $parent.find('.selected').removeClass('selected');
        $file.addClass('selected current');
        var remove;
        _.each($('.tree .dir'), function(dirEl) {
            if (remove) {
                $(dirEl).remove();
            } else if (dirEl === $parent[0]) {
                remove = true;
            }
        });
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
        $('body').append('<div class="tree-scroller"><div class="tree" /><div>');
        $('.tree-scroller').css('max-width', $(window).width() - $('#controls').width());
        $('#controls .edit').hide();
        $('#controls .dir').show();
        hookup_tree_nav();
    }

    var hide_dir_tree = function() {
        $('.app').show();
        $('.tree').remove();
        $('#controls .edit').show();
        $('#controls .dir').hide();
        unhook_tree_nav();
    }

    var hookup_tree_nav = function() {
        $(document).on('keydown', handle_tree_keydown);
    }

    var unhook_tree_nav = function() {
        $(document).off('keydown', handle_tree_keydown);
    }

    var handle_tree_keydown = function(e) {
        var stop = true;
        var $new_selection;
        switch(e.which) {
            // left arrow
            case 37:
                $current_dir = $current_dir.prev('.dir');
                $new_selection = $current_dir.find('.selected');
                break;
            // up arrow
            case 38:
                $new_selection = $current_dir.find('.current').prev();
                if ($new_selection.length == 0) {
                    $new_selection = $current_dir.children().last();
                }
                break;
            // enter
            case 13:
            // right arrow
            case 39:
                descend({
                    target: $current_dir.find('.current')[0]
                });
                break;
            // down arrow
            case 40:
                $new_selection = $current_dir.find('.current').next();
                if ($new_selection.length == 0) {
                    $new_selection = $current_dir.children().first();
                }
                break;
            default:
                stop = false;
                break;
        }
        if ($new_selection) {
            select_new_file($new_selection);
        }
        if (stop) {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    var select_new_file = function($new_selection) {
        var offset = $new_selection.offset();
        var bottom = $new_selection.outerHeight() + offset.top;
        var tree_height = $('.tree').height();
        var $current = $('.tree .current');
        if (bottom > tree_height) {
            $current_dir.scrollTop($current_dir.scrollTop() + (bottom - tree_height));
        } else if (offset.top < 0) {
            $current_dir.scrollTop($current_dir.scrollTop() + offset.top);
        }
        $new_selection.addClass('current');
        $current.removeClass('current');
    }

    var save_file = function() {
        if (!current_file) {
        }
        var contents = editor.getSession().getValue();
        current_file.write(contents, function(err) {
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
                console.log("current_file: " + current_file);
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
        show_blocking_notification('Drop file to edit.');
        stop_event(e);
    }

    var hide_drop_screen = function(e) {
        hide_blocking_notification();
        stop_event(e);
    }

    var show_blocking_notification = function(message) {
        $('.notif-screen').html(message);
        $('.notif-screen').show();
    }

    var hide_blocking_notification = function() {
        $('.notif-screen').hide();
    }

    var reset_editor = function(new_contents) {
        editor.getSession().setValue(new_contents);
        focus_editor();
        convert();
    }

    var focus_editor = function() {
        editor.focus();
    }

    var convert = function() {
        raw_input = editor.getSession().getValue();
        content = markdown.toHTML(raw_input);
        $('#preview').html(content);
    }

    var start_converting = function() {
        editor.getSession().on('change', convert);
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

    var size = function() {
        var controls_width = $('#controls').width();
        var window_width = $(window).width();
        var pane_width = Math.floor((window_width - controls_width)/2);
        $('#editor,#preview').width(pane_width);
    }

    return function() {
        size();
        hookup_controls();
        focus_editor();
        start_converting();
        load_readme();
    };
});

define(['fs/services'], function(services, local) {
    // This is an instance of File class that can be written
    var current_file;
    var current_dir;

    function doNothing() {}

    var stop_event = function(e) {
        e.stopPropagation();
        e.preventDefault();
    }

    var hookup_controls = function () {

        $('.controls .open').on('click', open);
        $('.controls .save').on('click', save_file);
        $('.controls .mkdir').on('click', _.bind(new_file_prompt, null, 'dir'));
        $('.controls .touch').on('click', _.bind(new_file_prompt, null, 'file'));
        $('.controls .cancel').on('click', hide_dir_tree);
        var editor_div = $('#editor')[0];
        window.editor = ace.edit(editor_div);
        window.editor.setTheme('ace/theme/textmate');
        window.editor.setHighlightActiveLine(false);
        window.editor.renderer.setShowGutter(false);
        window.editor.getSession().setUseWrapMode(true);
        require(['ace/mode/markdown'], function(mode) {
            window.editor.getSession().setMode(new mode.Mode());
        });
        window.editor.setShowPrintMargin(false);
        window.editor.commands.removeCommand('gotoline'); // uses CTRL/CMD-L which is annoying

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
        render_dir(new services.Directory());
    }

    var render_dir = function(dir) {
        dir.ls(function(entries) {
            var $dir = $('<ul class="dir" />');
            _.each(entries, function(entry) {
                var $dirEntry = $('<li class="entry" />')
                    .text(entry.name)
                    .attr('title', entry.name)
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
        window.editor.getSession().setValue(new_contents);
        focus_editor();
        convert();
    }

    var focus_editor = function() {
        window.editor.focus();
    }

    var convert = function() {
        raw_input = window.editor.getSession().getValue();
        content = markdown.toHTML(raw_input);
        $('.preview').html(content);
    }

    var start_converting = function() {
        window.editor.getSession().on('change', convert);
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

    return function() {
        hookup_controls();
        focus_editor();
        start_converting();
        load_readme();
    };
});

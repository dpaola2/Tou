var setup = function() {
    $('.editor textarea').on('input', function() {
        content = markdown.toHTML($('.editor textarea').val());
        $('.preview').html(content);
    });
}

$(setup)
var setup = function() {
    $('.editor textarea').focus();
    $('.editor textarea').on('input', function() {
        content = markdown.toHTML($('.editor textarea').val());
        $('.preview').html(content);
    });
}

$(setup)
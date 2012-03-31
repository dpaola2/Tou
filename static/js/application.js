var focus_editor = function() {
    $('.editor textarea').focus();    
}

var convert = function() {
    content = markdown.toHTML($('.editor textarea').val());
    $('.preview').html(content);
}

var start_converting = function() {
    $('.editor textarea').on('input', convert);
}

var load_content = function(content) {
    $('.editor textarea').val(content);
    convert();
}

var load_file = function(url) {
    $.ajax({
        url: "/load_file",
        data: {url: url},
        success: function(data, textStatus, jqxhr) { load_content(data); }, 
        error: function(jqxhr, textStatus, errorThrown) { load_content(textStatus); }
    });
}

var setup = function() {
    focus_editor();
    start_converting();
    load_file("http://tou.herokuapp.com/readme")
}

$(setup)
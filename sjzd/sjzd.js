;
var new_config = {
    'table': {
        "name"    : '',
        "version" : 0,
        "note"    : '',
        "fields"  : [],
        "index"   : {}
    },
    'type': {
        "version": 0,
        "name": '',
        "note": '',
        "dbtype": '',
        "key_name": '',
    },
    'constant': {
        "version": 0,
        "name": '',
        "value": {}
    }
};

var recent = [];
var disp_name = {'type': '类型', 'table': '表格', 'constant': '常量'};

var TF_map = [['note', 'note'], ['dbtype', 'dbtype'], ['name', 'key_name']]; //name should be the last one

var all_types = null;
var types_dict = null;

var current_tab = "table";

var current_table = null;
var edited_table = false;

var current_type = null;
var edited_type = false;

var current_constant = null;
var edited_constant = false;

var field_attr_sep = '-';

function O(id) { return document.getElementById(id); }

function call_data(type, action, name, data, callback) {
    data = data ? JSON.stringify(data) : '';
    $.post(
        'data/index.php',
        {
            'type'  : type, 
            'action': action, 
            'name'  : name,
            'data'  : data,
        },
        callback,
        'json'
    );
}

function get_list(type, reg, value, callback) {
    $.post(
        'data/list.php',
        {
            'type' : type, 
            'reg'  : reg,
            'value': value
        },
        callback,
        'json'
    );
}

function build_obj(data) {
    if (!Array.isArray(data)) {
        alert('bad input: ' + data);
        return;
    }
    var obj = $(data[0]);
    for (var i = 1; i < data.length; i++) {
        var child = data[i];
        if (Array.isArray(child))
            child = build_obj(child);
        obj.append(child);
    }
    return obj;
}

function htmlEscape(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function load_all_types() {
    get_list('type', '.*', 1, function (json) {
        if (json.errno == 0) {
            types_dict = json.data;
            all_types = [];
            $.each(types_dict, function (key, value) {
                all_types.push(key);
            });
        }
        else {
            alert('载入类型出错: ' + json.error);
        }
    });
}

window.onload = function() {
    $('#query').focus();
    load_all_types();

    //$('#query').val('mem');
    //switch_tab('table');

    if (localStorage) {
        if (!('recent' in localStorage)) 
            localStorage['recent'] = '[]';
        recent = JSON.parse(localStorage['recent']);
        if (!Array.isArray(recent))
            recent = [];
        display_recent();
    }
};

function pm_var(prefix, value) {
    var name = prefix + '_' + current_tab;
    try {
        if (arguments.length == 2) {
            var code = name + ' = ' + JSON.stringify(value);
            eval(code);
        }
        else {
            return eval(name);
        }
    }
    catch (e){
        var error = '操作暂不支持(' + name + '未实现)';
        alert(error);
        throw (new Error(error));
    }
}

function ignore_edited() {
    if (pm_var('edited') && !confirm('当前修改尚未保存，是否丢弃?')) {
        return false;
    }
    pm_var('edited', false);
    info('');
    return true;
}

function set_edit(no_refresh) {
    pm_var('edited', true);
    info('<= 已修改，请点击保存');
    no_refresh || display(pm_var('current'));
}

function info(msg) {
    $('#info_' + current_tab).html(msg);
}

function add_new() {
    if (!ignore_edited()) return;
    var name = $("#query").val();
    if (name.length <= 2) {
        alert('请输入正确的名称，再点击新建.');
        return;
    }
    call_data(current_tab, 'read', name, '', function (json) {
        if (json.errno == 0) {
            alert(name + '已经存在，请直接编辑。');
            display(json.data);
        }
        else if (json.errno == 1) {
            var conf = $.extend(true, {}, new_config[current_tab]); //deepcopy
            conf['name'] = name;
            pm_var('edited', true);
            display(conf);
        }
        else {
            alert('未知错误: ' + json.error);
        }
    });
}

function do_save() {
    if (!pm_var('edited')) {
        info('请修改后再保存');
        return;
    }

    if (current_tab == 'table') {
        $(current_table.fields).map(function (i, c_field) {
            if (!c_field.type)
                return;
            var type = types_dict[c_field.type];
            $.each(TF_map, function (i, pair) {
                var Tkey = pair[0], Fkey = pair[1];
                if (Tkey == 'name') return;
                if (c_field[Tkey] == type[Fkey])
                    c_field[Tkey] = '';
            });
        });
    }

    conf = pm_var('current');
    conf.version += 1;
    call_data(current_tab, 'write', conf.name, conf, function (json) {
        if (json.errno != 0) {
            info('保存失败: ' + json.error);
            conf.version -= 1;
            return;
        }
        info('保存成功!');
        pm_var('edited', false);
        display(conf);
        query();
    });
}

function update_recent(type, name)
{
    var new_recent = [[type, name]];
    recent.map(function (r) {
        if (!(r[0] == type && r[1] == name)) {
            new_recent.push(r);
        }
    });

    if (new_recent.length > 10) {
        new_recent.pop();
    }
    recent = new_recent;
    localStorage['recent'] = JSON.stringify(recent);
}

function display_recent() {
    $('#recent').html('')
                .append(recent.map(function (r) {
                    var type = r[0], text = r[1];
                    return $('<li>').append(build_obj(['<a>', disp_name[type], ': ', text]))
                                    .on('click', function () {
                                        $('#query').val(text);
                                        switch_tab(type);
                                    });
                }));
}

var query_text = '';
function query(force) {
    var text = $('#query').val();
    if (!force && text == query_text)
        return;
    query_text = text;
    if (text.length >= 2)
        do_query(text);
}

function do_query(text) {
    var result = $('#result').html('');
    get_list(current_tab, text, 0, function (json) {
        if (json.errno != 0) {
            alert('读取失败: ' + json.error);
            return;
        }
        matched = json['data'];
        for (var i = 0; i < matched.length; i++) {
            var name = matched[i];
            var a = $('<a>').html(name).on('click', (function(name) {
                 return function() { details(name); }; })(name)
            );
            result.append($('<li>').append(a));
        }
        if (matched.length == 1)
            details(matched[0]);
        else if (matched.length == 0)
            result.append($('<li><a>(无匹配项)</a></li>'));
    });
}

function attr_name(field_name, attr) {
    return field_name + field_attr_sep + attr;
}

function split_name_attr(name) {
    var idx = name.indexOf(field_attr_sep);
    var field_name = '', field_attr = '';
    if (idx < 0) {
        field_name = name;
    }
    else {
        field_name = name.substr(0, idx);
        field_attr = name.substr(idx + field_attr_sep.length);
    }
    return [field_name, field_attr];
}

function oField(name) {
    var _result = split_name_attr(name);
    var field_name = _result[0];

    var this_obj = {
        'name': field_name,
        'attr_name': function (at_name) {
            return field_name + field_attr_sep + at_name;
        },
        'attr_obj': function (at_name) {
            return $('#' + this_obj.attr_name(at_name));
        },
        'attr': function (at_name, value, do_update, no_refresh) {
            //console.log('oField(' + field_name + ').attr(' + at_name + ') = ' + value + ', do_update=' + do_update + ', no_refresh=' + no_refresh);
            var attr_obj = this_obj.attr_obj(at_name);
            switch(arguments.length) {
                case 1:
                    if (attr_obj.attr('type') == 'checkbox')
                        return attr_obj[0].checked;
                    else
                        return attr_obj.val();
                case 2:
                    if (attr_obj.attr('type') == 'checkbox')
                        attr_obj[0].checked = value;
                    else
                        attr_obj.val(value);
                    return this_obj;
                case 3:
                case 4:
                    this_obj.attr(at_name, value);
                    if (do_update)
                        update_current_table(this_obj.attr_name(at_name), value, no_refresh);
                    return this_obj;
                default:
                    throw(new Error('unknown arguments: ' + JSON.stringify(arguments)));
            }
        }
    }
    return this_obj;
}

function remove_field(name) {
    var new_fields = [];
    var removed = false;
    current_table.fields.map(function (c_field) {
        if (c_field.name != name)
            new_fields.push(c_field);
    });
    current_table.fields = new_fields;
    set_edit();
}

function update_current_table(name, value, no_refresh) {
    console.log('update: ' + name + ' => ' + value);
    if (name == '__new') return;

    var idx = name.indexOf(field_attr_sep);
    if (idx < 0) { //table attr
        if (current_table[name] == value) //not changed
            return;
        current_table[name] = value;
        console.log('  updated!');
    }
    else { //existing field_attr
        var _result = split_name_attr(name);
        field_name = _result[0];
        field_attr = _result[1];

        //修改了当前字段的名字，并且其他字段也用了新的名字
        if (field_attr == 'name' && value != field_name && table_has_field(value)) {
            return same_field_warning(field_name);
        }

        for (var i = 0; i < current_table.fields.length; i++) {
            var c_field = current_table.fields[i];
            if (field_attr == 'seq')
                value = Number.parseInt(value);
            if (c_field.name == field_name) {
                if (c_field[field_attr] == value) //not changed
                    return false;
                c_field[field_attr] = value;
                console.log('  updated!');
            }
        }
    }
    set_edit(no_refresh);
}

function details(name) {
    if (!ignore_edited()) return;
    call_data(current_tab, 'read', name, '', function (json) {
        if (json.errno != 0) {
            alert('读取' + current_tab + '[' + name + ']失败: ' + json.error);
            return;
        }
        display(json.data);
    });
}

function display(conf) {
    update_recent(current_tab, conf.name);
    pm_var('display')(conf);
    display_recent();
    $('#detail_' + current_tab).css('display', 'block');
}

function table_has_field(field_name) {
    var cnt = 0;
    $.each(current_table.fields, function (i, c_field) {
        if (field_name == c_field.name) {
            cnt += 1;
        }
    });
    return cnt;
}

function same_field_warning(field_name) {
    info('已存在同名字段，请修改后再保存。');
    oField(field_name).attr_obj('name').css('background-color', '#ff8080').focus();
}

function add_new_field () {
    var o_field = oField('__new');
    if (table_has_field(o_field.attr('name')))
        return same_field_warning('__new');

    var new_field = {};
    $(['seq', 'name', 'type', 'dbtype', 'note', 'null']).map(function (i, key) {
        new_field[key] = o_field.attr(key);
    });

    var ok = true;
    $.each({'seq': '序号', 'name': '名称', 'dbtype': '数据库类型'}, function (key, value) {
        if (new_field[key] == '') {
            info('请填写<' + value + '>字段');
            o_field.attr_obj(key).css('background-color', '#ff8080').focus();
            ok = false;
            return false;
        }
    });
    if (!ok) return;

    current_table.fields.push(new_field);
    set_edit();
}

function display_table(table_conf)
{
    current_table = table_conf;
    current_table.fields.sort(function (a, b) { return a.seq > b.seq; });

    function mk_text(name, value, width, v_id, other) {
        return $('<input type="text" ' + (other || '') + ' />')
            .attr('name', name).attr('id', v_id || name).css('width', width || '90%').val(value)
            .on('blur', function () {
                var o = O(v_id || name);
                update_current_table(o.name, o.value);
            });
    }

    function mk_type_selector(name, value, v_id) {
        var null_value = '(无)';
        return $('<select>').attr('name', name).attr('id', v_id || name).css('width', '90%')
              .append($('<option value="">').val(null_value))
              .append(all_types.map(function (typename) {
                  var option = $('<option>').val(typename).html(typename);
                  if (typename == value)
                      option.attr('selected', 'selected');
                  return option;
              }))
             .on('change', function () {
                 var o_field = oField(this.id);
                 if (this.value == null_value) {
                     o_field.attr('type', '', 'update');
                     return;
                 }
                 var type = types_dict[this.value];

                 if (o_field.name != '__new')
                     o_field.attr('type', this.value, 'update');

                 $.each(TF_map, function (i, pair) {
                     var Tkey = pair[0], Fkey = pair[1];
                     if (!(Fkey in type))
                         return;
                     if (o_field.name == '__new')
                         o_field.attr(Tkey, type[Fkey]);
                     else
                         o_field.attr(Tkey, type[Fkey], 'update');
                 });
             });
    }

    var header = build_obj([
        '<tr style="background-color:#ccc;">',
            ['<td width="30">', '序号'],
            ['<td width="200">', '名称'],
            ['<td width="150">', '描述'],
            ['<td width="120">', '数据库类型'],
            ['<td width="200">', '业务类型'],
            ['<td width="100">', '属性'],
            ['<td width="50">', '操作']
    ]);

    var arr_tr = [header];

    var max_seq = 0;
    $(table_conf.fields).map(function (i, c_field) {
        function mk_name(attr) { return attr_name(c_field.name, attr); }

        function is_pkey(name) {
            var pkey = table_conf.index.__primary_key;
            if (pkey) 
                for (var i = 0; i < pkey.length; i++)
                    if (name == pkey[i])
                        return true;
            return false;
        }

        max_seq = Math.max(c_field.seq, max_seq);

        var pkey = $('<input type="checkbox" disabled="disabled">')
        pkey[0].checked = is_pkey(c_field.name);

        var isNull = $('<input type="checkbox">').attr('name', mk_name("null")).attr('id', mk_name("null"));
        isNull[0].checked = c_field.null;
        isNull.on('click', (function (id) {
            return function () { update_current_table(O(id).name, O(id).checked) }
        })(mk_name('null')));

        var bgcolor = '';
        if (c_field.key) bgcolor = 'background-color:#c8ebff;';
        else if (i % 2 == 0) bgcolor = 'background-color:#f5f5f5;';

        var type = types_dict[c_field.type];
        var dbtype = c_field.dbtype.length > 0 ? c_field.dbtype : (type ? type.dbtype : '');
        var note   = c_field.note.length   > 0 ? c_field.note   : (type ? type.note   : '');

        var tr = build_obj([
            '<tr style="' + bgcolor + '">', 
                ['<td style="text-align:center;">', mk_text(mk_name('seq'), c_field.seq, '20px')],
                ['<td>', mk_text(mk_name('name'), c_field.name)],
                ['<td>', mk_text(mk_name('note'), note)],
                ['<td>', mk_text(mk_name('dbtype'), dbtype)],
                ['<td>', mk_type_selector(mk_name('type'), c_field.type)],
                ['<td>', isNull, 'NULL',  ' ', pkey, '主键'],
                ['<td>', '<input type="button" onclick="remove_field(\'' + c_field.name + '\')" value="删除" />']
        ]);

        arr_tr.push(tr);
    });


    arr_tr.push(build_obj([
        '<tr style="background-color:#d2e6ff;">', 
            ['<td style="text-align:center;">', mk_text('__new', max_seq + 1, '20px', '__new-seq')],
            ['<td>', mk_text('__new', '', null, '__new-name')],
            ['<td>', mk_text('__new', '', null, '__new-note')],
            ['<td>', mk_text('__new', '', null, '__new-dbtype')],
            ['<td>', mk_type_selector('__new', '', '__new-type')],
            ['<td>', $('<input type="checkbox">').attr('name', '__new')
                                                 .attr('id', '__new-null')
                                                 .attr('title', "unchecked: not null"),
                     'NULL'],
            ['<td>', $('<input type="button">').val('添加').on('click', add_new_field)]
    ]));

    $('#title_table').html("[版本:" + table_conf.version + "] " + table_conf.name);
    $('#note_table').html('').append(mk_text('note', table_conf.note, '60%', 'table_note_input'));
    $('#fields_table').html('').append(arr_tr);

    //$('#content_table').css('display', 'block');
    $('#detail_table').css('display', 'block');

    display_index();

    $('#sql').val(generate_sql(table_conf));
}

function remove_index(index_name) {
    if (!confirm('确定要删除索引<' + index_name + '>吗?')) {
        return;
    }
    if (index_name in current_table.index) {
        delete current_table.index[index_name];
        set_edit();
    }
}

function update_index(index_name, field_name, action) {
    var c_index = current_table.index[index_name];
    //console.log('update_index: ' + index_name + ', ' + field_name + ', ' + action);
    var field_idx = 0;

    $(c_index).map(function (i, name) {
        if (name == field_name)
            field_idx = i;
    });

    function swap(i, j) {
        var tmp = c_index[i];
        c_index[i] = c_index[j];
        c_index[j] = tmp
    }

    if (action == 'append') {
        new_field_name = $('#' + field_name).val();
        if (!table_has_field(new_field_name)) {
            alert('表格中没有该字段');
            $('#' + field_name).focus();
            return;
        }
        c_index.push(new_field_name);
    }
    else if (action == 'up') {
        if (field_idx > 0)
            swap(field_idx, field_idx - 1);
        else
            return;
    }
    else if (action == 'down') {
        if (field_idx < c_index.length - 1)
            swap(field_idx, field_idx + 1);
        else
            return;
    }
    else if (action == 'remove') {
        current_table.index[index_name] = c_index.filter(function (name) { return name != field_name; });
    }
    else {
        alert('unknown action');
        throw(new Error('unknown action'));
    }
    set_edit();
}

function display_index() {
    indice = current_table.index;
    $('#index').html('');

    function mk_updater(index_name, field_name, action) {
        return function () {
            update_index(index_name, field_name, action);
        }
    }

    var arr_td = [];
    function display_one_index(index_name, c_index) {
        var o_index = $('<div>')
                                .css('width', '300px').attr('id', 'index-' + index_name)
                                .css('background-color', '#f5f5f5').css('padding', '10px').css('margin', '10px');
        arr_td.push(o_index);

        var disp_name = (index_name == '__primary_key' ? '[主键]' : index_name);
        header = build_obj(['<div>', ['<strong>', disp_name]]);
        o_index.append(header);

        function mk_updater(index_name, field_name, action) {
            return function () {
                update_index(index_name, field_name, action);
            }
        }

        $(c_index).map(function (i, field_name) {
            o_index.append(build_obj([
                '<div class="form-inline" style="margin-top: 2px;">',
                    $('<button>').attr('class', 'btn').css('width', '180px').append(field_name),
                    $('<button>').attr('class', 'btn')
                                 .on('click', mk_updater(index_name, field_name, 'up'))
                                 .append($('<i>').attr('class', 'icon-arrow-up')),
                    $('<button>').attr('class', 'btn')
                                 .on('click', mk_updater(index_name, field_name, 'down'))
                                 .append($('<i>').attr('class', 'icon-arrow-down')),
                    $('<button>').attr('class', 'btn')
                                 .on('click', mk_updater(index_name, field_name, 'remove'))
                                 .append($('<i>').attr('class', 'icon-remove'))
            ]));
        });

        var new_id = 'index-' + index_name + '-newfield';
        function index_has_field(name) {
            for (var i = 0; i < c_index.length; i++)
                if (c_index[i] == name)
                    return true;
            return false;
        }

        o_index.append(build_obj([
            '<div class="form-inline" style="margin-top: 2px;">',
                $('<select>').css('width', '180px').attr('id', new_id)
                    .append(current_table.fields.map(function (c_field) {
                        if (index_has_field(c_field.name))
                            return '';
                        return $('<option>').val(c_field.name).append(c_field.name);
                    })),
                $('<button>').attr('class', 'btn')
                             .on('click', mk_updater(index_name, new_id, 'append'))
                             .append($('<span>').attr('class', 'icon-plus')),
        ]));

        o_index.append(index_grid);
        o_index.append($('<button class="btn" onclick="remove_index(\'' + index_name + '\')">').css('margin-top', '10px').append('删除此索引'));
        //$('#index').append(o_index);
    }

    if ('__primary_key' in indice)
        display_one_index('__primary_key', indice.__primary_key);

    $.each(indice, function (index_name, c_index) {
        if (index_name != '__primary_key')
            display_one_index(index_name, c_index);
    });

    var index_grid = $('<table>');
    $('#index').append(index_grid);

    for (var i = 0; i < arr_td.length / 3; i++) {
        var tr = $('<tr>');
        index_grid.append(tr);
        for (var j = 0; j < 3; j++) {
            tr.append($('<td valign="top">').append(arr_td[i * 3 + j]));
        }
    }
}

function add_index() {
    $('#new_index_name').css("background-color", "#fff");
    function warn_index(msg) {
        alert(msg);
        $('#new_index_name').css("background-color", "#ff8080").focus();
    }

    var is_primary_key = O('is_primary_key').checked;
    O('is_primary_key').checked = false;

    var index_name = is_primary_key ? '__primary_key' : O('new_index_name').value;
    if (index_name.length < 2)
        return warn_index('请输入完整索引名称');

    if (index_name in current_table.index)
        return warn_index((is_primary_key ?  '主键已存在' : '已存在同名索引') + ', 请修改');

    current_table.index[index_name] = [];
    set_edit();
}

function display_type(type_conf) {
    current_type = type_conf;

    /*
    'type': {
        "version": 0,
        "name": '',
        "note": '',
        "dbtype": '',
        "key_name": ''
    },
    */

    var x = {
        'note': '说明',
        'dbtype': '数据库类型',
        'key_name': '默认字段名称',
    }

    $('#title_type').html("[版本:" + type_conf.version + "] " + type_conf.name);

    function updater(attr) {
        if (!(attr in type_conf)) {
            alert('bad attr: ' + attr);
            return;
        }
        return function update_current_type() {
            var o = O('type-' + attr);
            console.log('update[' + attr + ']: ' + type_conf[attr] + ' => ' + o.value);
            if (type_conf[attr] == o.value)
                return;
            console.log('  updated!');
            type_conf[attr] = o.value;
            set_edit();
        }
    }

    var fields_type = build_obj([
        '<table class="table table-bordered" style="width:600px;">',
            ['<tr>', 
                ['<td width="120">', '说明'],
                ['<td>', $('<input type="text">').css('width', '90%').attr('id', 'type-note')
                                                 .val(type_conf['note']).on('blur', updater('note'))]],
            ['<tr>', 
                ['<td>', '数据库类型'],
                ['<td>', $('<input type="text">').css('width', '90%').attr('id', 'type-dbtype')
                                                 .val(type_conf['dbtype']).on('blur', updater('dbtype'))]],
            ['<tr>', 
                ['<td>', '默认字段名'],
                ['<td>', $('<input type="text">').css('width', '90%').attr('id', 'type-key_name')
                                                 .val(type_conf['key_name']).on('blur', updater('key_name'))]]
            ]);

    $('#fields_type').html('').append(fields_type);
}

function display_constant(constant_conf)
{
    current_constant = constant_conf;

    $('#title_constant').html("[版本:" + constant_conf.version + "] " + constant_conf.name);

    var fields_constant = $('<table class="table table-bordered" style="width:600px;">');

    fields_constant.append(build_obj([
        '<tr>', 
            ['<td width="120">', '取值'],
            ['<td width="200">', '含义']
    ]));

    function adjust(key) {
        if (typeof(key) != 'string')
            return JSON.stringify(key);
        return key;
    }

    $.each(constant_conf.value, function (key, value) {

        fields_constant.append(build_obj([
            '<tr>',
                ['<td>', $('<input type="text">').css('width', '120px').val(key).on('blur', function () {
                                var new_key = this.value;
                                if (new_key != key) {
                                    if (new_key in current_constant.value) {
                                        info('该枚举值已经存在，请换一个');
                                        this.focus();
                                        return;
                                    }
                                    delete current_constant.value[key];
                                    current_constant.value[new_key] = value;
                                    set_edit();
                                }
                         })],
                ['<td>', $('<input type="text">').val(value).on('blur', function () {
                                if (this.value != value) {
                                    current_constant.value[key] = this.value;
                                    set_edit('no_refresh');
                                }
                         })],
                ['<td>', $('<input type="button">').attr('name', key).val('删除').on('click', function () {
                                delete current_constant.value[key];
                                set_edit();
                         })]
        ]));
    });

    fields_constant.append(build_obj([
        '<tr>',
            ['<td>', $('<input type="text">').css('width', '180px').attr('id', '__new_key')],
            ['<td>', $('<input type="text">').attr('id', '__new_value')],
            ['<td>', $('<input type="button">').val('添加').on('click', function () {
                        var key = O('__new_key').value, value = O('__new_value').value;
                        if (key in current_constant.value) {
                            info('该枚举值已经存在，请直接修改');
                            return;
                        }
                        current_constant.value[key] = value;
                        set_edit();
                     })]
    ]));

    $('#fields_constant').html('').append(fields_constant);
}

function generate_sql(table_conf) {

    var comments = [sprintf('comment on table %s is \'%s\';', table_conf.name, table_conf.note)];

    var fields = table_conf.fields.map(function (c_field) {
        var type = types_dict[c_field.type];
        var dbtype = c_field.dbtype.length > 0 ? c_field.dbtype : (type ? type.dbtype : '');
        var note = c_field.note.length > 0 ? c_field.note : (type ? type.note : '');
        var isNull = c_field.null ? '' : ' not null';
        comments.push(sprintf('comment on column %s.%s is \'%s\';', table_conf.name, c_field.name, note));
        return c_field.name + ' ' + dbtype + isNull;
    });

    var pkey = '';
    if ('__primary_key' in table_conf.index)
        pkey = ",\n    primary key (" + table_conf.index['__primary_key'].join(', ') + ')';

    var arr_create_index = [];
    $.each(table_conf.index, function (c_key, c_index) {
        if (c_key == '__primary_key') return;
        var index_name = table_conf.name + '__' + c_key;
        arr_create_index.push("create index " + index_name + " on " + table_conf.name + " (" + c_index.join(', ') + ");");
    })

    var sql = 'create table ' + table_conf.name + " \n(\n    " +
              fields.join(",\n    ") + 
              pkey +
              "\n);\n\n" +
              arr_create_index.join("\n") + '\n\n' +
              comments.join('\n');;

    return sql;
}

function switch_tab(name) {
    if (!ignore_edited()) return;

    if (name == 'table')
        load_all_types();

    $(['table', 'type', 'constant']).map(function (i, key) {
        if (key == name) {
            //$('#detail_' + key).css('display', 'block');
            $('#tab_' + key).attr('class', 'active');
        }
        else {
            $('#tab_' + key).attr('class', '');
        }
        $('#detail_' + key).css('display', 'none');
    });

    current_tab = name;
    $('#query').focus();
    setTimeout(function () { query(true); }, 100);
}

<?php

header("Content-Type: application/json; charset=utf-8");

require('func.php');

/*
$test_data_type = <<<eot
{
    "version": 1,
    "note": "客户号",
    "dbtype": "char(10)"
}
eot;

//*
$_REQUEST = array(
    'type'      => 'type',
    'action'    => 'write',
    'name'      => 'F_client_id',
    'data'      => $test_data_type, #for write
    //'force'     => 1, #for write
);
// */

$type = basename($_REQUEST['type']);
type_check($type);

$name   = basename($_REQUEST['name']);
if (strlen($name) < 3) {
    err("999", "bad name");
}

$fname = F($type, $name);
$exists = file_exists($fname);

$action = $_REQUEST['action'];
switch ($action)
{
    case 'read':
        if ($exists)
            ok($fname, TYPE_FILENAME);
        else
            err(1, 'file not exists');

    case 'write':
        $data = stripslashes_gpc($_REQUEST['data']);

        $jdata_new = json_decode($data);
        if (is_null($jdata_new))
        {
            err('2', "bad input data, json_decode failed");
        }
        
        if ($exists)
        {
            $jdata_old = json_decode(file_get_contents($fname));
            if (is_null($jdata_new))
            {
                err('999', "corrupted file data, json_decode failed");
            }

            $new_ver = $jdata_new->version;
            $old_ver = $jdata_old->version;

            //echo $new_ver, ' vs ', $old_ver, "\n";

            if (isset($_REQUEST['force']) or $new_ver == $old_ver + 1)
            {
                file_put_contents($fname, $_REQUEST['data']);
                err(0, 'ok');
            }
            else if ($new_ver < $old_ver + 1)
            {
                err(3, '可能别人已经修改过了，请更新到新版本再修改');
            }
            else /* ($new_ver > $old_ver + 1) */
            {
                err(999, 'bad version (too large)');
            }
        }
        else
        {
            file_put_contents($fname, $data);
            err(0, 'ok');
        }
        break;

    default:
        err(999, 'unknown action');
}

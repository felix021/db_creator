<?php

define("TYPE_JSON", 1);
define("TYPE_OBJECT", 2);
define("TYPE_FILENAME", 3);

function pwd()
{
	return dirname(__FILE__);
}

function F($dir, $name)
{
	return sprintf("%s/%s/%s.js", pwd(), $dir, $name);
}

function err($errno, $error='')
{
    echo sprintf('{"errno": %d, "error": "%s"}', $errno, $error);
    exit(0);
}

function ok($data, $type)
{
    $str = '';
    switch($type)
    {
        case TYPE_JSON:
            $str = $data;
            break;

        case TYPE_OBJECT:
            $str = json_encode($data, true);
            break;

        case TYPE_FILENAME:
            $str = file_get_contents($data);
            break;

        default:
            throw new Exception("unknown type: " . $type);
    }
    echo sprintf('{"errno": 0, "error": "ok", "data": %s}', $str);
    exit(0);
}

function type_check($type)
{
    if (!in_array($type, array("table", "type", "constant")))
        err("999", "bad type");
}

function stripslashes_gpc($data)
{
    if (get_magic_quotes_gpc())
        return stripslashes($data);
    return $data;
}


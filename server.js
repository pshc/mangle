var appId = '';
var apiHost = 'api.microsofttranslator.com';
var apiPath = '/V2/Ajax.svc/Translate';

function mangle(text, langs, gotStage, callback) {
	var lastLang = null;
	require('async').reduce(langs, text, function (text, lang, cb) {
		gotStage(text);
		var from = lastLang;
		lastLang = lang;
		translate(text, from, lang, cb);
	}, function (err, last) {
		if (err)
			callback(err);
		gotStage(last);
		callback(null);
	});
}

function translate(text, fromLang, toLang, callback) {
	var query = {appId: appId, to: toLang, text: text};
	if (fromLang)
		query.from = fromLang;
	var uri = {protocol: 'http:', hostname: apiHost, pathname: apiPath, query: query};
	uri = require('url').format(uri);
	require('request').get(uri, function (err, resp, body) {
		if (err)
			return callback(err);
		if (resp.statusCode != 200)
			return callback(body);
		body = removeBOM(body);
		var translated;
		try {
			translated = JSON.parse(body);
		}
		catch (e) {
			return callback(e.toString() + ': ' + body);
		}
		callback(null, translated);
	});
}

// WTF Microsoft
function removeBOM(text) {
	if (text && text.charCodeAt(0) == 0xfeff)
		return text.substr(1);
	return text;
}

var htmlHeaders = {'Content-Type': 'text/html; charset=UTF-8'};
var htmlHead = '<!doctype html><meta charset=UTF-8><title>Mangle</title>\n';

var languages = 'ar bg ca zh-CHS zh-CHT cs da nl en et fi fr de el ht he hi hu id it ja ko lv lt no pl pt ro ru sk sl es sv th tr uk vi'.split(' ');
var server = require('http').createServer(function (req, resp) {
	var query = require('url').parse(req.url, true).query;
	if (query.text) {
		var langs = query.langs || '';
		langs = langs.split(/[^a-zA-Z\-]+/).filter(function (lang) {
			return languages.indexOf(lang) >= 0;
		});
		if (!langs.length)
			langs = ['ja', 'pl', 'en'];
		langs = langs.slice(0, 10);
		if (langs.join(' ') != query.langs) {
			var canon = require('querystring').encode({text: query.text, langs: langs.join(' ')});
			resp.writeHead(307, {Location: '?' + canon});
			resp.end();
			return;
		}

		resp.writeHead(200, htmlHeaders);
		resp.write(htmlHead);
		function gotStage(text) {
			resp.write(escapeHTML(text) + '<br>\n');
		}
		mangle(query.text, langs, gotStage, function (err) {
			resp.end(err ? escapeHTML(err) : '');
		});
	}
	else {
		resp.writeHead(200, htmlHeaders);
		resp.write(htmlHead);
		resp.write('<form><input name=text size=100><input name=langs value="ja pl en"><input type=submit></form>');
		resp.end('Languages: ' + languages.join(' '));
	}
});

server.listen(8000);

// C'mon this must be available in the stdlib
var escapes = {'&' : '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'};
function escapeHTML(text) {
        return text.replace(/[&<>"]/g, function (s) { return escapes[s]; });
}

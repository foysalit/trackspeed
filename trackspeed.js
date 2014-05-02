var Page = require('webpage'),
    _ = require('lodash'),
    Colors = require('colors'),
    Async = require('async'),
    System = require('system');

if(System.args.length === 1){
    console.log('Usage: trackspeed.js <some URL> <repeat each url>');
    phantom.exit(1);
}

var address = System.args[1],
    repeat = System.args[2] || 5,
    urlsPage = Page.create(),
    url = "http://testdummy.info/files.txt",
    visitedPages = {};

var Logger = {
    colorify: function (message, color) {
        if(System.os && System.os.name == 'windows')
            return message;

        return message[color];
    },
    warn: function (message) {
        console.log(this.colorify(message, 'yellow'));
    },
    info: function (message) {
        console.log(this.colorify(message, 'cyan'));
    },
    error: function (message) {
        console.log(this.colorify(message, 'red'));
    },
    ok: function (message) {
        console.log(this.colorify(message, 'green'));
    }
};

//load the urls that we're going to measure the loadtime of
var loadPages = function (url, cb) {
    var visited = 0;

    visitedPages[url] = {
        error: false,
        visits: [],
        started : new Date()
    };

    Logger.warn('Collecting data from url - '+ url);

    var visitUrl = function (callback) {
        visitedPages[url].visits[visited] = {
            started : new Date(),
            resources : 0
        };

        var page = Page.create();

        page.onError = function () {};
        page.onResourceReceived = function () {
            ++visitedPages[url].visits[visited].resources;
        };

        //Logger.warn('visit - '+ (visited + 1) + ' to url: '+ url);

        page.open(url, function (status) {
            if(status !== 'success'){
                visitedPages[url].error = true; 
                Logger.error('stopping further attempt cause the url isn\'t accesible');
                visited = 5;
                callback();
                return;
            }

            //Logger.warn('closing page for visit: '+ (visited + 1));

            visitedPages[url].visits[visited].ended = new Date();

            page.close(); 
            page.release();
            ++visited;
            callback();
        });
    };

    Async.whilst(function () {
        return visited < repeat;
    }, visitUrl, function (error) {
        if(error) console.log(error);
        visitedPages[url].ended = new Date();
        cb.apply();
    });
};

//measure the load time in seconds from started and ended value of a page
var measureLoadTime = function (obj) {
    if(obj.ended)
        return (obj.ended - obj.started) / 1000;
    else 
        return 0;
};

//gets called when all the urls are visited and loadtimes are measured
var allUrlsVisited = function (error) {
    if(error)
        Logger.error("ERROR: ", err);


    _.forEach(visitedPages, function (p, url) {
        console.log('URL: '+ url);

        if(p.error){
            Logger.error("couldn't be opened");
            return;
        }

        _.forEach(p.visits, function (timer, index) {
            var resMsg = ' total resources loaded: '+ timer.resources;
                loadTimeMsg = 'Loadtime for visit - '+ index +' is : '+ measureLoadTime(timer) + resMsg; 
            Logger.info(loadTimeMsg);
        });

        var avgLoadTime = (measureLoadTime(p) / p.visits.length).toFixed(3),
            loadTimeMsg = 'Average Loadtime: '+ avgLoadTime +'sec.';

        Logger.ok(loadTimeMsg); 
    });

    phantom.exit();
}

//scrapes all the urls from a web page
urlsPage.open(address, function (status) {
    if (status !== 'success') {
        console.log('FAIL to load the address');
        phantom.exit();
        return;
    }

    urls = urlsPage.evaluate(function () {
        return document.querySelector('pre').innerHTML.split("\n");
    });

    Async.eachSeries(urls, loadPages, allUrlsVisited);
});
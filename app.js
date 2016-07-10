var config = require('./config.js');
var express = require('express');
var https = require('https');
var app = express();
var MongoClient = require('mongodb').MongoClient;


app.get('/search/:term', function(req, response) {
    if (!req.query.offset)
        req.query.offset = 0;
    var page = 10 * req.query.offset + 1;
    var url = 'https://www.googleapis.com/customsearch/v1?q=' + req.params.term + '&cx=' + config.google.cseID + '&searchType=image&start=' + page + '&fields=items(image(contextLink%2CthumbnailLink)%2Clink%2Cpagemap%2Ctitle)&key=' + config.google.apiKey;

    https.get(url, (res) => {
        var chunks = "";
        res.setEncoding('utf8');
        res.on("data", (chunk) => {
            chunks += chunk;
        });
        res.on("end", () => {
            console.log("HTTP request ended. Sending JSON.");
            response.send(JSON.parse(chunks));
        }).on('error', (e) => {
            console.log(`Got error: ${e.message}`);
        });
    });

    //could be saved in a local file too, since there are only 10 entries
    //used MongoDB for practice
    MongoClient.connect(config.db.host, function(err, db) {
        if (err) throw err;
        var p1 = new Promise((resolve, reject) => {
            db.collection('searches').update({}, {
                $inc: {
                    "id": 1
                }
            }, {
                multi: true
            }, () => {
                db.collection('searches').deleteOne({
                    "id": {
                        $eq: 10
                    }
                }, () => {
                    console.log("p1 done.");
                    resolve();
                });
            });
        });
        var p2 = new Promise((resolve, reject) => {
            db.collection('searches').insertOne({
                "index": 0,
                "query": req.params.term,
                "time": Date()
            }, () => {
                console.log("p2 done.");
                resolve();
            });
        });
        Promise.all([p1, p2]).then(() => {
            console.log("Successfully resolved, closing db connection.")
            db.close();
            response.end();
        });
    });
});

app.get('/recent', (req, response) => {
    MongoClient.connect(config.db.host, function(err, db) {
        db.collection('searches').find({
            index: {$exists: true}
        }, {
			"_id": 0,
            "query": 1,
            "time": 1
        }).sort({index:1}).toArray((err, items) => {
            response.send(items));
            db.close();
            response.end();
        });
    });
});

app.use(express.static('public'));
app.get('/', () => {
    //homepage
});

app.listen(process.env.PORT || 3000, function() {
    console.log("Image abstraction layer started on port 3000.");
});

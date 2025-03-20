const express = require("express");

const {google} = require("googleapis");

const app = express();

const bcrypt = require('bcrypt');

const spreadsheetId = ""; /* Enter your Sheet ID Here */

const saltRounds = 10;

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/admin", (req, res) => {
    res.render("admin");
});

app.get("/order", (req, res) => {
    res.render("order");
});

app.post("/order", async (req, res) => {
    const { tableID } = req.body;

    

    const auth = new google.auth.GoogleAuth({
        keyFile: "credentials.json",
        scopes: "https://www.googleapis.com/auth/spreadsheets",
    });

    const client = await auth.getClient();

    const googleSheets = google.sheets({version: "v4", auth: client});

    

    const metaData = await googleSheets.spreadsheets.get({
        auth,
        spreadsheetId,
    });

    const getRows = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: "Sheet1!A:D",
    });

    const rowID = parseInt(tableID) + 1;
    const database = getRows.data.values;

    const url = database[parseInt(tableID)][3];
    if(url == undefined) {
        res.send(`<h1>Error.</h1>
            <h2>This table's URL havn't been generate.</h2>
            <h2>Please ask staff for help!</h2>
        `);
    } else if(database[parseInt(tableID)][1] == "FALSE") {
        await googleSheets.spreadsheets.values.update({
            auth,
            spreadsheetId,
            range: `Sheet1!${rowID}:${rowID}`,
            valueInputOption: "USER_ENTERED",
            resource: {
                values: [[tableID, "TRUE"]],
            },
        });
        const info = {
            id: tableID,
            url: url,
        }
        res.render(`order`, {info});
        // res.send(`
        //     <h1>Success!</h1>
        //     <p>Your url is <b>${url}</b>.</p>
        // `);
    } else {
        res.send(`<h1>Access Denied.</h1>
            <h2>The current url has been used by another user.</h2>
            <h2>Please use their's device to order!</h2>
        `);
    }
    

    
    
});

app.post("/generate", async (req, res) => {
    const { tableID } = req.body;
    const url = `Table${tableID}`;
    var hashUrl = null;
    var hashSalt = null;
    bcrypt.genSalt(saltRounds, (err, salt) => {
        if (err) {
            // Handle error
            return;
        }
        
        // Salt generation successful, proceed to hash the password
        hashSalt = salt;
        bcrypt.hash(url, salt, (err, hash) => {
            if (err) {
                // Handle error
                return;
            }
        
        // Hashing successful, 'hash' contains the hashed password
            hashUrl = hash;
        });
    });
    

    const auth = new google.auth.GoogleAuth({
        keyFile: "credentials.json",
        scopes: "https://www.googleapis.com/auth/spreadsheets",
    });

    const client = await auth.getClient();

    const googleSheets = google.sheets({version: "v4", auth: client});

    const metaData = await googleSheets.spreadsheets.get({
        auth,
        spreadsheetId,
    });

    const getRows = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: "Sheet1!A:D",
    });

    const rowID = parseInt(tableID) + 1;


    await googleSheets.spreadsheets.values.update({
        auth,
        spreadsheetId,
        range: `Sheet1!${rowID}:${rowID}`,
        valueInputOption: "USER_ENTERED",
        resource: {
            values: [[tableID, "FALSE", 0, hashUrl]],
        },
    });
    res.send(`
        <h1>Submitted!</h1>

        <p>Original url: <br />
            <b>https://www.example.com/order/${url}</b>
        </p>
        <p>Salt: <br />
            <b>${hashSalt}</b>
            </p>
        <p>Hashed url: <br />
            <b>https://www.example.com/order/${hashUrl}</b>
        </p>
    `);
    

    
    
});

app.post("/deliver", async (req, res) => {
    const { tableID, payment } = req.body;
    console.log(tableID);
    const auth = new google.auth.GoogleAuth({
        keyFile: "credentials.json",
        scopes: "https://www.googleapis.com/auth/spreadsheets",
    });

    const client = await auth.getClient();

    const googleSheets = google.sheets({version: "v4", auth: client});

    const metaData = await googleSheets.spreadsheets.get({
        auth,
        spreadsheetId,
    });

    const getRows = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: "Sheet1!A:D",
    });

    const rowID = parseInt(tableID) + 1;


    await googleSheets.spreadsheets.values.update({
        auth,
        spreadsheetId,
        range: `Sheet1!${rowID}:${rowID}`,
        valueInputOption: "USER_ENTERED",
        resource: {
            values: [[tableID, "TRUE", payment]],
        },
    });

    res.send(`
        <h1>Ordered!</h1>
        <h2>Please wait for your order.</h2>
        <h2>Payment is HKD ${payment}.</h2>
    `);

});

app.post("/delete", async (req, res) => {
    const { tableID } = req.body;

    const url = `https://www.example.com/order/table${tableID}`;

    const auth = new google.auth.GoogleAuth({
        keyFile: "credentials.json",
        scopes: "https://www.googleapis.com/auth/spreadsheets",
    });

    const client = await auth.getClient();

    const googleSheets = google.sheets({version: "v4", auth: client});

    const metaData = await googleSheets.spreadsheets.get({
        auth,
        spreadsheetId,
    });

    const getRows = await googleSheets.spreadsheets.values.get({
        auth,
        spreadsheetId,
        range: "Sheet1!A:D",
    });

    const rowID = parseInt(tableID) + 1;


    await googleSheets.spreadsheets.values.update({
        auth,
        spreadsheetId,
        range: `Sheet1!${rowID}:${rowID}`,
        valueInputOption: "USER_ENTERED",
        resource: {
            values: [[tableID, "FALSE", "", ""]],
        },
    });
    res.send(`<h1>Deleted.</h1>`);
});

app.listen(5050, (req, res) => console.log("Running on 5050"));
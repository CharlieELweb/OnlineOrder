# OnlineOrder
## How to test it on your computer
0. Download NMP and NodeJS
1. Get Google API Credentials at [Google Cloud Website](https://console.cloud.google.com)
2. Create a new project and enable Google Sheet API.
3. Create Credentials in "Credentials" tab and choose Service account.
4. Copy the **email** of the Service Account.
5. Add a **json** key, web will download a file. Rename it to "**credentials.json**" and put it in a new folder.
6. Create a new sheet and share it to **email** you copied(make sure to enable EDIT)
7. download all the files of this repository to your new folder.
8. Open Terminal and input codes below
`nmp init`
`npm install express ejs googleapis`
`npm install -D nodemon`

9. Put your sheet ID in index.js(Where says"Put your code HERE")
11. Use `nodemon index.js` to run the code. And you can get the website at `127.0.0.1:5050`


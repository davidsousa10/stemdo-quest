const { GoogleSpreadsheet } = require('google-spreadsheet');
const { OAuth2Client } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}/auth/callback`
  : 'http://localhost:3000/auth/callback';
const SPREADSHEET_ID = '1zdSd-6j-eCST65FkxyHXe4HCc9iI5UtJ8-IrrDqnPr8';
const TOKENS_PATH = path.join(__dirname, 'tokens.json');

const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

let doc = null;
let sheet = null;

function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

async function handleCallback(code) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens));
  await connectSheet();
  return true;
}

async function connectSheet() {
  try {
    doc = new GoogleSpreadsheet(SPREADSHEET_ID, oauth2Client);
    await doc.loadInfo();
    sheet = doc.sheetsByIndex[0];

    const headers = sheet.headerValues;
    if (!headers || headers.length === 0) {
      await sheet.setHeaderRow(['Nombre', 'Email', 'Puntuacion', 'Fecha']);
    }

    console.log('Google Sheets conectado');
    return true;
  } catch (err) {
    console.error('Error conectando a Google Sheets:', err.message);
    doc = null;
    sheet = null;
    return false;
  }
}

async function init(app) {
  // Auth callback route
  app.get('/auth/callback', async (req, res) => {
    try {
      await handleCallback(req.query.code);
      res.send('<h1 style="font-family:sans-serif;text-align:center;margin-top:3rem">Google Sheets conectado! Ya puedes cerrar esta ventana.</h1>');
    } catch (err) {
      res.status(500).send('Error: ' + err.message);
    }
  });

  // Try loading saved tokens
  if (fs.existsSync(TOKENS_PATH)) {
    try {
      const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH));
      oauth2Client.setCredentials(tokens);

      oauth2Client.on('tokens', (newTokens) => {
        const merged = { ...tokens, ...newTokens };
        fs.writeFileSync(TOKENS_PATH, JSON.stringify(merged));
      });

      await connectSheet();
    } catch (err) {
      console.log('Tokens guardados invalidos, necesitas autenticar de nuevo');
      console.log('Abre esta URL:', getAuthUrl());
    }
  } else {
    console.log('');
    console.log('Para conectar Google Sheets, abre esta URL:');
    console.log(getAuthUrl());
    console.log('');
  }
}

async function addScore(name, email, score) {
  if (!sheet) return;
  try {
    await sheet.addRow({
      Nombre: name,
      Email: email,
      Puntuacion: score,
      Fecha: new Date().toLocaleString('es-ES')
    });
  } catch (err) {
    console.error('Error escribiendo en Google Sheets:', err.message);
  }
}

module.exports = { init, addScore };

const express = require('express');
const dotenv = require('dotenv');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');          
dotenv.config();
const crypto = require('crypto');

const algorithm = 'aes-256-cbc';
const secretKey = process.env.SECRET_KEY;

// Encrypt function
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Decrypt function
function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = parts.join(':');
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const url = process.env.MONGO_URI || 'mongodb://localhost:27017';
const client = new MongoClient(url);

const dbName = process.env.DB_NAME || 'passop';
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());             

async function start() {
  try {
    await client.connect();
    console.log('MongoDB connected to', url);

    app.get('/', async (req, res) => {
  try {
    const db = client.db(dbName);
    const collection = db.collection('documents');
    const results = await collection.find({}).toArray();

    const decryptedResults = results.map(item => ({
      ...item,
      password: decrypt(item.password)
    }));

    res.json(decryptedResults);
  } catch (err) {
    console.error('GET error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

    app.post('/', async (req, res) => {
  try {
    const db = client.db(dbName);
    const collection = db.collection('documents');
    const data = req.body;

    if (!data.site || !data.username || !data.password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const encryptedPassword = encrypt(data.password);

    const insertResult = await collection.insertOne({
      site: data.site,
      username: data.username,
      password: encryptedPassword,
      createdAt: new Date()
    });

    res.status(201).json({ success: true, insertedId: insertResult.insertedId });
  } catch (err) {
    console.error('POST error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

    app.delete('/:id', async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ success: false, error: 'Invalid id' });
        }

        const db = client.db(dbName);
        const collection = db.collection('documents');
        const result = await collection.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 1) {
          return res.json({ success: true, deletedCount: 1 });
        } else {
          return res.status(404).json({ success: false, error: 'Not found' });
        }
      } catch (err) {
        console.error('DELETE /:id error:', err);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
      }
    });

    app.listen(port, () =>
      console.log(`Example app listening at http://localhost:${port}`)
    );

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
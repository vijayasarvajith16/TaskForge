const { MongoClient } = require('mongodb');
const dns = require('dns');

// Configure public DNS resolvers to prevent querySrv ECONNREFUSED on Windows/ISPs
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore fallback
}

let db = null;
let client = null;

async function connectDb(uri) {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  console.log('Connected to MongoDB:', db.databaseName);
  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialised — call connectDb first');
  return db;
}

async function closeDb() {
  if (client) {
    await client.close();
    db = null;
    client = null;
  }
}

module.exports = { connectDb, getDb, closeDb };

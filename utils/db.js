const sha1 = require('sha1');
const { MongoClient, ObjectId } = require('mongodb');

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    const url = `mongodb://${host}:${port}`;
    this.client = new MongoClient(url, { useUnifiedTopology: true });

    this.client.connect()
      .then(() => {
        this.db = this.client.db(database);
      })
      .catch((err) => {
        console.error('MongoDB connection error:', err);
      });
  }

  isAlive() {
    return this.client && this.client.isConnected();
  }

  async nbUsers() {
    if (!this.isAlive()) return 0;
    const usersCollection = this.db.collection('users');
    return usersCollection.countDocuments();
  }

  async nbFiles() {
    if (!this.isAlive()) return 0;
    const filesCollection = this.db.collection('files');
    return filesCollection.countDocuments();
  }

  async findUserByEmailAndPassword(email, password) {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const hashedPassword = sha1(password);
    return this.db.collection('users').findOne({ email, password: hashedPassword });
  }

  async findUserById(id) {
    return this.db.collection('users').findOne({ _id: ObjectId(id) });
  }
}

// Export an instance of DBClient
const dbClient = new DBClient();
module.exports = dbClient;

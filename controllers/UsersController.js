import sha1 from 'sha1';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    // Validate password
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    try {
      const userExists = await dbClient.db
        .collection('users')
        .findOne({ email });

      // Check if email already exists
      if (userExists) {
        return res.status(400).json({ error: 'Already exist' });
      }

      // Hash password
      const hashedPassword = sha1(password);

      // Insert user into database
      const result = await dbClient.db.collection('users').insertOne({
        email,
        password: hashedPassword,
      });

      // Return the new user with id and email
      return res.status(201).json({ id: result.insertedId, email });
    } catch (error) {
      console.error('Error inserting user:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export default UsersController;

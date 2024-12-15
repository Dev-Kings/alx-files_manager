import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { ObjectId } from 'mongodb';
import mime from 'mime-types';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    // Validate `data` for non-folder types
    if (type !== 'folder') {
      if (!data || typeof data !== 'string' || data.trim() === '') {
        return res.status(400).json({ error: 'Missing data' });
      }
    }

    if (parentId !== 0) {
      const parent = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });
      if (!parent) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parent.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const fileDoc = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? 0 : ObjectId(parentId),
    };

    if (type === 'folder') {
      const result = await dbClient.db.collection('files').insertOne(fileDoc);

      // Exclude the _id from the response
      const { _id, ...fileDocWithoutId } = fileDoc;

      return res.status(201).json({ id: result.insertedId, ...fileDocWithoutId });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const localPath = path.join(folderPath, uuidv4());
    fs.writeFileSync(localPath, Buffer.from(data, 'base64'));

    fileDoc.localPath = localPath;

    const result = await dbClient.db.collection('files').insertOne(fileDoc);

    // Exclude `localPath` from the response and renaming `_id` to `id`
    const { localPath: _, _id, ...responseDoc } = fileDoc;

    return res.status(201).json({ id: result.insertedId, ...responseDoc });
  }

  // GET /files/:id
  static async getShow(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;

    try {
      const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      const { _id, ...fileData } = file;
      return res.status(200).json({ id: _id, ...fileData });
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }
  }

  // GET /files
  static async getIndex(req, res) {
    const token = req.header('X-Token');
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Handle default values for parentId and page
    const parentId = req.query.parentId || '0';
    const page = parseInt(req.query.page, 10) || 0;
    const itemsPerPage = 20;

    const query = {
      userId: ObjectId(userId),
      parentId: parentId === '0' ? 0 : ObjectId(parentId),
    };

    try {
      const files = await dbClient.db
        .collection('files')
        .aggregate([
          { $match: query },
          { $skip: itemsPerPage * parseInt(page, 10) },
          { $limit: itemsPerPage },
        ])
        .toArray();

      const response = files.map((file) => {
        const { _id, ...fileData } = file;
        return { id: _id, ...fileData };
      });

      return res.status(200).json(response);
    } catch (error) {
      return res.status(500).json({ error: 'Server error' });
    }
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId });

    if (!file) return res.status(404).json({ error: 'Not found' });

    await dbClient.db.collection('files').updateOne(
      { _id: dbClient.getObjectId(fileId) },
      { $set: { isPublic: true } },
    );

    const updatedFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId) });
    return res.status(200).json({
      id: updatedFile._id,
      userId: updatedFile.userId,
      name: updatedFile.name,
      type: updatedFile.type,
      isPublic: updatedFile.isPublic,
      parentId: updatedFile.parentId,
    });
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    console.log(req.params);
    console.log(userId);
    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId });
    if (!file) return res.status(404).json({ error: 'Not found' });

    await dbClient.db.collection('files').updateOne(
      { _id: dbClient.getObjectId(fileId) },
      { $set: { isPublic: false } },
    );

    const updatedFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId) });
    return res.status(200).json({
      id: updatedFile._id,
      userId: updatedFile.userId,
      name: updatedFile.name,
      type: updatedFile.type,
      isPublic: updatedFile.isPublic,
      parentId: updatedFile.parentId,
    });
  }

  static async getFile(req, res) {
    const fileId = req.params.id;
    const token = req.header('X-Token');
    let userId = null;

    // Authenticate the user (if a token is provided)
    if (token) {
      userId = await redisClient.get(`auth_${token}`);
    }

    try {
      // Find the file document by ID
      const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId) });

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Check if the file is public or the user is the owner
      if (!file.isPublic && (!userId || file.userId.toString() !== userId)) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Check if the file is a folder
      if (file.type === 'folder') {
        return res.status(400).json({ error: "A folder doesn't have content" });
      }

      // Check if the file is locally present
      if (!fs.existsSync(file.localPath)) {
        return res.status(404).json({ error: 'Not found' });
      }

      // Get the MIME type of the file
      const mimeType = mime.lookup(file.name) || 'application/octet-stream';

      // Return the content of the file
      res.setHeader('Content-Type', mimeType);
      const fileContent = fs.readFileSync(file.localPath);
      return res.status(200).send(fileContent);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default FilesController;

import redis from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    // Create the Redis client
    this.client = redis.createClient();

    // Listen for errors on the Redis client
    this.client.on('error', (err) => {
      console.error(`Redis client not connected to the server: ${err.message}`);
    });

    // Promisify Redis client methods for asynchronous use
    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setAsync = promisify(this.client.set).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);
  }

  /**
   * Check if Redis client is alive (connected)
   * @returns {boolean}
   */
  isAlive() {
    return this.client.connected;
  }

  /**
   * Get a value by key from Redis
   * @param {string} key - The key to retrieve the value for
   * @returns {Promise<string | null>} - The value associated with the key, or null if not found
   */
  async get(key) {
    try {
      return await this.getAsync(key);
    } catch (err) {
      console.error(`Error getting key "${key}": ${err.message}`);
      return null;
    }
  }

  /**
   * Set a value with an expiration time in Redis
   * @param {string} key - The key to set
   * @param {string | number} value - The value to set
   * @param {number} duration - The expiration time in seconds
   */
  async set(key, value, duration) {
    try {
      await this.setAsync(key, value, 'EX', duration);
    } catch (err) {
      console.error(`Error setting key "${key}": ${err.message}`);
    }
  }

  /**
   * Delete a key from Redis
   * @param {string} key - The key to delete
   */
  async del(key) {
    try {
      await this.delAsync(key);
    } catch (err) {
      console.error(`Error deleting key "${key}": ${err.message}`);
    }
  }
}

// Create and export a single instance of RedisClient
const redisClient = new RedisClient();
export default redisClient;

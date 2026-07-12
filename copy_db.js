import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('No MONGODB_URI found in .env');
  process.exit(1);
}

const sourceDbName = 'test';
const targetDbName = 'dev_dorm';

async function copyDatabase() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const sourceDb = client.db(sourceDbName);
    const targetDb = client.db(targetDbName);

    // Get all collections in source DB
    const collections = await sourceDb.listCollections().toArray();
    console.log(`Found ${collections.length} collections in source DB`);

    for (const collInfo of collections) {
      const collName = collInfo.name;
      console.log(`Copying collection: ${collName}...`);

      const sourceColl = sourceDb.collection(collName);
      const targetColl = targetDb.collection(collName);

      // Read all documents
      const docs = await sourceColl.find({}).toArray();

      if (docs.length > 0) {
        // Drop target collection if it exists to start fresh
        try {
          await targetColl.drop();
        } catch (e) {
          // Ignore if doesn't exist
        }

        // Insert documents into target
        await targetColl.insertMany(docs);
        console.log(`  -> Copied ${docs.length} documents`);
      } else {
        console.log(`  -> Collection empty, skipping`);
      }
    }

    console.log('Database copy completed successfully!');
  } catch (error) {
    console.error('Error copying database:', error);
  } finally {
    await client.close();
  }
}

copyDatabase();

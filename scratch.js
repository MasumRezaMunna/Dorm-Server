import mongoose from 'mongoose';

async function fix() {
  await mongoose.connect('mongodb+srv://masumrezamunna420_db_user:FEbGLR0MVXwOph2r@cluster0.ovxzilk.mongodb.net/dev_dorm?appName=Cluster0');
  const Bill = mongoose.model('Bill', new mongoose.Schema({}, { strict: false, collection: 'bills' }));

  try {
    await Bill.collection.dropIndex('memberId_1_month_1_year_1');
    console.log('Unique index dropped successfully — multiple bills per month now allowed.');
  } catch (err) {
    console.log('Index drop result:', err.message);
  }

  process.exit(0);
}

fix().catch(console.error);

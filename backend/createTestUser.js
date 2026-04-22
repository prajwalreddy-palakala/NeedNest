require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI;

async function createTestUser() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Remove existing test user
    await usersCollection.deleteOne({ email: 'test@neednest.com' });

    // Hash the password manually
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Test@123', salt);

    const now = new Date();
    const testUser = {
      name: 'Test User',
      email: 'test@neednest.com',
      phone: '9999999999',
      password: hashedPassword,
      location: {
        city: 'Hyderabad',
        state: 'Telangana',
        address: '123 Test Street',
        pincode: '500001'
      },
      role: 'user',
      userType: 'both',
      avatar: '',
      isActive: true,
      itemsDonated: 0,
      itemsReceived: 0,
      createdAt: now,
      updatedAt: now
    };

    await usersCollection.insertOne(testUser);

    console.log('\n✅ Test user created successfully!');
    console.log('─────────────────────────────────');
    console.log('📧 Email    : test@neednest.com');
    console.log('🔑 Password : Test@123');
    console.log('👤 UserType : Both (Donor & Receiver)');
    console.log('─────────────────────────────────\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createTestUser();

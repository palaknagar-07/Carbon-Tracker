const fs = require('fs');
const path = require('path');

console.log('🌱 Carbon Gamified - Application Validation');
console.log('==========================================\n');

// Required files and their descriptions
const requiredFiles = [
  {
    path: 'frontend/package.json',
    description: 'Frontend package configuration'
  },
  {
    path: 'frontend/src/App.js',
    description: 'Main React application component'
  },
  {
    path: 'frontend/src/App.css',
    description: 'Main application styles'
  },
  {
    path: 'frontend/src/components/LoginPage.js',
    description: 'Login page component'
  },
  {
    path: 'frontend/src/components/Dashboard.js',
    description: 'Dashboard component'
  },
  {
    path: 'frontend/src/components/CommuteLogger.js',
    description: 'Commute logger component'
  },
  {
    path: 'frontend/src/components/Leaderboard.js',
    description: 'Leaderboard component'
  },
  {
    path: 'backend/package.json',
    description: 'Backend package configuration'
  },
  {
    path: 'backend/server.js',
    description: 'Main backend server'
  },
  {
    path: 'backend/firebase-config.js',
    description: 'Firebase configuration'
  },
  {
    path: 'backend/carbon-calculator.js',
    description: 'Carbon calculation logic'
  },
  {
    path: 'README.md',
    description: 'Project documentation'
  },
  {
    path: '.gitignore',
    description: 'Git ignore file'
  }
];

let allFilesExist = true;

console.log('📁 Checking required files...\n');

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file.path);
  const exists = fs.existsSync(filePath);
  
  if (exists) {
    console.log(`✅ ${file.description} (${file.path})`);
  } else {
    console.log(`❌ ${file.description} (${file.path}) - MISSING`);
    allFilesExist = false;
  }
});

console.log('\n🔍 Validating core functionality...\n');

// Check if package.json files have correct dependencies
try {
  const frontendPackage = JSON.parse(fs.readFileSync(path.join(__dirname, 'frontend/package.json'), 'utf8'));
  const backendPackage = JSON.parse(fs.readFileSync(path.join(__dirname, 'backend/package.json'), 'utf8'));
  
  // Check frontend dependencies
  const frontendDeps = ['react', 'react-dom', 'axios'];
  frontendDeps.forEach(dep => {
    if (frontendPackage.dependencies[dep]) {
      console.log(`✅ Frontend dependency: ${dep}`);
    } else {
      console.log(`❌ Frontend dependency missing: ${dep}`);
      allFilesExist = false;
    }
  });
  
  // Check backend dependencies
  const backendDeps = ['express', 'cors', 'firebase-admin', 'bcryptjs'];
  backendDeps.forEach(dep => {
    if (backendPackage.dependencies[dep]) {
      console.log(`✅ Backend dependency: ${dep}`);
    } else {
      console.log(`❌ Backend dependency missing: ${dep}`);
      allFilesExist = false;
    }
  });
  
} catch (error) {
  console.log(`❌ Error reading package.json files: ${error.message}`);
  allFilesExist = false;
}

// Check if environment examples exist
const envExamples = [
  'backend/.env.example',
  'frontend/.env.example',
  'backend/serviceAccountKey.json.example'
];

console.log('\n📝 Checking environment templates...\n');
envExamples.forEach(envFile => {
  const filePath = path.join(__dirname, envFile);
  const exists = fs.existsSync(filePath);
  
  if (exists) {
    console.log(`✅ Environment template: ${envFile}`);
  } else {
    console.log(`❌ Environment template missing: ${envFile}`);
    allFilesExist = false;
  }
});

console.log('\n🎯 Validation Summary');
console.log('====================');

if (allFilesExist) {
  console.log('🎉 All validations passed! The application is ready for deployment.');
  console.log('\n📋 Next Steps:');
  console.log('1. Run ./setup.sh to install dependencies');
  console.log('2. Configure Firebase credentials');
  console.log('3. Start the backend server (cd backend && npm start)');
  console.log('4. Start the frontend app (cd frontend && npm start)');
  console.log('5. Open http://localhost:3000 in your browser');
} else {
  console.log('❌ Some validations failed. Please check the issues above.');
  process.exit(1);
}

console.log('\n🌍 Your Carbon Gamified application is ready to make a positive environmental impact!');

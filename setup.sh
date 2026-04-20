#!/bin/bash

echo "🌱 Carbon Gamified - Setup Script"
echo "=================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js is installed"

# Setup Backend
echo ""
echo "📦 Setting up Backend..."
cd backend
npm install

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit backend/.env with your Firebase credentials"
fi

# Check if serviceAccountKey.json exists
if [ ! -f serviceAccountKey.json ]; then
    echo "📝 Creating serviceAccountKey.json from template..."
    cp serviceAccountKey.json.example serviceAccountKey.json
    echo "⚠️  Please replace the content of serviceAccountKey.json with your Firebase service account key"
fi

cd ..

# Setup Frontend
echo ""
echo "📦 Setting up Frontend..."
cd frontend
npm install

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit frontend/.env with your Firebase config"
fi

cd ..

echo ""
echo "🎉 Setup Complete!"
echo ""
echo "Next Steps:"
echo "1. Configure Firebase:"
echo "   - Create a Firebase project at https://console.firebase.google.com/"
echo "   - Enable Firestore Database"
echo "   - Generate a service account key"
echo "   - Update backend/.env and backend/serviceAccountKey.json"
echo "   - Update frontend/.env with your Firebase config"
echo ""
echo "2. Start the application:"
echo "   - Backend: cd backend && npm start"
echo "   - Frontend: cd frontend && npm start"
echo ""
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "🌍 Happy eco-tracking!"

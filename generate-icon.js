/**
 * This script converts the SVG icon to a PNG file.
 * To use this script:
 * 1. Install the required packages: npm install sharp
 * 2. Run the script: node generate-icon.js
 */

const fs = require('fs');
const sharp = require('sharp');

// SVG content for the Codabra icon - VSCode sidebar style
const svgContent = `<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Chat bubble with code brackets - VSCode style monochromatic icon -->
  <path fill-rule="evenodd" clip-rule="evenodd" d="M64 16C37.49 16 16 37.49 16 64C16 90.51 37.49 112 64 112C70.6274 112 76.9487 110.558 82.6641 108H96C101.523 108 106 103.523 106 98V82.6641C108.558 76.9487 110 70.6274 110 64C110 37.49 88.51 16 64 16ZM64 24C84.9868 24 102 41.0132 102 64C102 69.2223 100.957 74.1826 99.0762 78.6641L98 80.8359V98C98 99.1046 97.1046 100 96 100H80.8359L78.6641 99.0762C74.1826 100.957 69.2223 102 64 102C45.0132 102 28 84.9868 28 64C28 41.0132 45.0132 24 64 24Z" fill="#424242"/>
  
  <!-- Code brackets inside chat bubble -->
  <path d="M52 48L40 64L52 80" stroke="#424242" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M76 48L88 64L76 80" stroke="#424242" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M68 44L60 84" stroke="#424242" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Convert SVG to PNG
async function convertSvgToPng() {
  try {
    // Create a temporary SVG file
    fs.writeFileSync('temp-icon.svg', svgContent);

    // Convert SVG to PNG using sharp
    await sharp('temp-icon.svg')
      .resize(128, 128)
      .png()
      .toFile('icon.png');

    // Remove the temporary SVG file
    fs.unlinkSync('temp-icon.svg');

    console.log('Successfully created icon.png');
  } catch (error) {
    console.error('Error converting SVG to PNG:', error);
  }
}

convertSvgToPng();

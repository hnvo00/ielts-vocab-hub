#!/usr/bin/env node

/**
 * Auto-generate vocabularies.json from HTML files
 * 
 * Usage: node generate-vocab-config.js
 * 
 * This script:
 * 1. Scans the current directory for HTML files matching pattern: NN Topic.html (e.g., 01 Weather.html)
 * 2. Extracts title, description, and vocabulary count from each file
 * 3. Generates data/vocabularies.json automatically
 * 
 * No manual updates needed - just add a new HTML file and run this script!
 */

const fs = require('fs');
const path = require('path');

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
};

// Gradient colors for each topic (cycle through these)
const gradientColors = [
    'from-blue-400 to-cyan-500',
    'from-emerald-400 to-teal-500',
    'from-orange-400 to-rose-500',
    'from-purple-400 to-pink-500',
    'from-indigo-400 to-blue-500',
    'from-cyan-400 to-emerald-500',
    'from-rose-400 to-orange-500',
    'from-violet-400 to-purple-500',
];

function log(message, type = 'normal') {
    const colorCode = colors[type] || colors.reset;
    console.log(`${colorCode}${message}${colors.reset}`);
}

function extractVocabularySectionFromHtml(htmlContent) {
    try {
        // Extract title
        const titleMatch = htmlContent.match(/<h1[^>]*id="mainTitle"[^>]*>([^<]+)<\/h1>/);
        const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

        // Extract description
        const descMatch = htmlContent.match(/<p[^>]*id="complexitySummarySection"[^>]*>([^<]+)<\/p>/);
        const description = descMatch ? descMatch[1].trim().substring(0, 200) : 'No description';

        // Count vocabulary items by finding all "no": X entries in the vocabData array
        const vocabCountMatch = htmlContent.match(/const vocabData = \[([\s\S]*?)\];/);
        let vocabularyCount = 0;
        
        if (vocabCountMatch) {
            const vocabArray = vocabCountMatch[1];
            // Count objects in the array (each vocab group has "no": X)
            const noMatches = vocabArray.match(/"no"\s*:\s*\d+/g) || [];
            vocabularyCount = noMatches.length;
        }

        return {
            title,
            description,
            topics: vocabularyCount > 0 ? vocabularyCount : 1,
        };
    } catch (error) {
        log(`Error parsing HTML: ${error.message}`, 'yellow');
        return null;
    }
}

function generateVocabulariesList() {
    try {
        const currentDir = process.cwd();
        const files = fs.readdirSync(currentDir);

        // Find all HTML files matching pattern: NN Topic.html
        const htmlFiles = files
            .filter(file => {
                return (
                    file.endsWith('.html') &&
                    /^\d{2}\s/.test(file) && // Starts with 2 digits and a space
                    file !== 'index.html' // Exclude index.html
                );
            })
            .sort(); // Sort alphabetically

        if (htmlFiles.length === 0) {
            log('⚠️  No vocabulary HTML files found! Expected pattern: 01 Topic.html, 02 Topic.html, etc.', 'yellow');
            return [];
        }

        log(`\n📚 Found ${htmlFiles.length} vocabulary file(s):`, 'blue');

        const vocabularies = htmlFiles.map((filename, index) => {
            const filePath = path.join(currentDir, filename);
            const htmlContent = fs.readFileSync(filePath, 'utf-8');
            const extracted = extractVocabularySectionFromHtml(htmlContent);

            if (!extracted) {
                log(`  ❌ ${filename} - failed to parse`, 'red');
                return null;
            }

            const id = filename.match(/^(\d{2})/)[1]; // Extract ID like "01"
            const vocabEntry = {
                id,
                filename,
                title: extracted.title,
                description: extracted.description,
                topics: extracted.topics,
                color: gradientColors[index % gradientColors.length],
            };

            log(`  ✓ ${filename}`, 'green');
            log(`    - Title: ${vocabEntry.title.substring(0, 60)}...`);
            log(`    - Topics: ${vocabEntry.topics} groups`);

            return vocabEntry;
        });

        return vocabularies.filter(v => v !== null);
    } catch (error) {
        log(`\n❌ Error scanning directory: ${error.message}`, 'red');
        return [];
    }
}

function saveVocabulariesJson(vocabularies) {
    try {
        // Ensure data directory exists
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            log(`📁 Created data/ directory`, 'blue');
        }

        const configPath = path.join(dataDir, 'vocabularies.json');
        fs.writeFileSync(configPath, JSON.stringify(vocabularies, null, 2));

        log(`\n✅ Successfully generated: data/vocabularies.json`, 'green');
        log(`   Contains ${vocabularies.length} vocabulary topic(s)\n`, 'green');

        return true;
    } catch (error) {
        log(`\n❌ Error writing vocabularies.json: ${error.message}`, 'red');
        return false;
    }
}

// Main execution
function main() {
    log('\n🚀 Auto-generating vocabularies.json from HTML files...\n', 'blue');

    const vocabularies = generateVocabulariesList();

    if (vocabularies.length === 0) {
        log('\n⚠️  No vocabularies to generate. Exiting.', 'yellow');
        process.exit(1);
    }

    const success = saveVocabulariesJson(vocabularies);
    process.exit(success ? 0 : 1);
}

main();

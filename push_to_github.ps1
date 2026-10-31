# Push script for Xile AI repository
# This script will clean up the repository and push only the necessary files

# Remove all tracked files from git
git rm -r --cached .

# Add .gitignore to ensure large files are not tracked
git add .gitignore

# Commit the .gitignore
git commit -m "Update .gitignore to exclude large files"

# Add all remaining files (excluding node_modules and others)
git add .

# Commit all project files
git commit -m "Add all project files excluding node_modules and other large files"

# Push to GitHub
git push origin main

Write-Host "Push completed. Check your repository at https://github.com/T-cat-codes/Xile-AI"
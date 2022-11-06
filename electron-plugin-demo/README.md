git init

git add .
git commit -m "xxx"
git branch -M main
git remote add origin https://github.com/imohuan/electron-plugin-demo.git
git push -u origin main

git gc --prune=now
git add .
git commit -m "xxx"
git push

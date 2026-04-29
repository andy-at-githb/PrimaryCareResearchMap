# GitHub + Render Checklist

1. Check whether you already have GitHub.
2. Create a GitHub repo for this app.
3. Upload the contents of this `render-upload` folder to the repo root.
4. Create or sign in to your Render account.
5. Create a new Render Web Service from that GitHub repo.
6. Confirm Render uses Node with:
   - Build Command: `npm install`
   - Start Command: `node server.js`
7. Add `HOST=0.0.0.0` in Render environment variables if needed.
8. Deploy.
9. Open the Render URL and test the app.
10. Share the public link with reviewers.

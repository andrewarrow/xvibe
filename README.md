# XVibe

![screenshot](https://i.imgur.com/fdsRPxQ.png)
![screenshot](https://i.imgur.com/3Zkxzcb.png)


A simple web application with a React frontend and Node.js backend using SQLite database.
This was made with claude code and these prompts:

```
{
  "history": [
    "this is a brand new project. Use react and node and sqlite. Start with a splash page with login and regsiter buttons. Use vite or esbuild. Give me a test user username \"andrewarrow\" password \"testing\". Once logged in have a logout button. Use tailwindcss.",
    "change all typescript to just plain javascript. remove all typescript from build process.",
    "on the logged in Welcome to XVibe page, add a textfield. The user can enter any youtube url and the server should launch an external process to the program \"yt-dlp\" with that url as the cli param. Store the file in a directory called \"videos\". Name it a random uuid and the extension of the video type. Use websockets to tell the frontend when the video is down downloading.",
    "now capture the stderr and stdout of the running yt-dlp processs for \"[download] 23.5% of 8.23MiB at 2.35MiB/s ETA 00:15",
    "add your first database migration for a new table called videos with a user_id. Make logged in homepage display a list of all the users previous downloads.",
    "add the file extension to the list of videos. Make a button to run ffmpeg to convert a format to mp4 and also capture stdout err for this and show the progress.",
    "make each row in \"Your Video Downloads\" clickable and goto a \"video detail page\" with a button for \"get key frames\". This button should use ffmpeg to get just the key frame jpgs. In the videos directory have a uuid as a directory and all the files for one video inside that directory. On the video detail page as the keyframes as ready display them.",
    "add a button to video detail page for \"get text\"",
    "change how \"get text\" button works to run yt-dlp --skip-download --write-auto-sub --sub-lang en \"https://www.youtube.com/watch?v=VIDEO_ID\" and save the captions in a file ",
    "add a new button \"parse captions\" to video detail page. It should open the captions.vtt and match up the text with the times so that the display of keyframes can include the text below each keyframe image.  It's ok if it doesn't line up perfectly. Just in a nice big font under each keyframe jpg try and have the text.",
    "the parsing caption logic has artifacts like \"mind felt undeniably lighter and but only<00:20:09.480><c\" fix that",
    "when I click on a keyframe in the video detail page and it selects that's great. But when I select another keyframe I want that 2nd keyframe (and all the keyframes between) to highlight as well. Have a new button for \"extract clip\" that makes a new video and computes the starting point and ending points based on the selected frames."
  ]
}
```

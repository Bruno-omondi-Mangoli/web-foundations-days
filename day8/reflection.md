# Reflection

The most difficult concept in the course was asynchronous JavaScript with fetch, async and await. At first I forgot to use await, so I saw Promise {<pending>} instead of my data, and I did not realise fetch does not throw on a 404. I overcame it by adding console.log at each step, watching the requests in the DevTools Network tab, and rebuilding the Day 5 lab from scratch until I could explain every line.

Based on the feedback I received, I would improve the explanation of my architecture. For example, I would show the request in the Network tab when I create a note, and explain more clearly how the cache is invalidated when a note changes. I would also connect QuickNotes to a real backend so notes belong to real user accounts instead of being stored only in localStorage.

Next, I want to learn Node.js and Express so I can turn my API design into working code, then PostgreSQL to store QuickNotes data for real users, and a front-end framework such as React. I will keep practising the basics with freeCodeCamp and MDN until they feel natural.
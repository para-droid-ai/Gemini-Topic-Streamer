
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// The problem statement indicates that index.html includes Tailwind via CDN,
// so no global CSS import is needed here.
// Also, ensure `react-markdown` and `remark-gfm` are installed if you haven't already:
// `npm install react-markdown remark-gfm` or `yarn add react-markdown remark-gfm`

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
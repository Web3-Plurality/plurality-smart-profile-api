import { useState,useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState("Hello")


  
  useEffect(() => {
    const eventSource = new EventSource('https://app.plurality.local:5000/oauth-twitter/register-event');
    eventSource.onmessage = function(event) {
        // const data = JSON.parse(event.data);
        setCount(JSON.parse(event.data)?.message);
    };

    return () => {
        eventSource.close();
    };
}, []);

  return (
    <>
    {count}
    </>
  )
}

export default App

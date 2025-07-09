import React from 'react'
import { assets } from '../assets/assets'
import {motion} from 'framer-motion'
const Description = () => {
  return (
    <motion.div
    initial={{opacity:0.2, y:100}}
    transition={{duration:1}}
    whileInView={{opacity:1, y:0}}
    viewport={{once:true}}
     className='flex flex-col items-center justify-center my-24 p-6 md:px-28'>
        <h1 className='text-3xl sm:text-4xl font-semibold mb-2'>Create AI images</h1>
    <p className='text-gray-500 mb-8'>Turn your imagination into visuals</p>
    <div className='flex flex-col gap-5 md:gap-14 md:flex-row items-center'>
        <img src={assets.sample_img_1} className='w-80 xl:w-96 rounded-lg'/>
       <div>
  <h2 className='text-3xl font-medium max-w-lg'>
    Introducing the AI-Powered Text to Image Generator
  </h2>
  <p className='text-gray-600 mb-4'>
    Turn your words into stunning visuals instantly with our cutting-edge AI engine. Whether you're a designer, marketer, student, or creative enthusiast—bring your imagination to life like never before.
  </p>

  <ul className='text-gray-600 mb-4'>
    <li>✨ Simply enter a prompt.</li>
    <li>🎨 Watch the AI generate high-quality images in seconds.</li>
    <li>🔮 No design skills needed—just your creativity.</li>
  </ul>


  <p className='text-gray-600 mb-4'>
    With a user-friendly interface and seamless experience, anyone can bring their ideas to life—no technical background required. It's fast, intuitive, and incredibly powerful.
  </p>

  <p className='text-gray-600'>
    Join thousands of users who are already using our AI image generator to transform ideas into art. Start creating now and explore the limitless potential of imagination.
  </p>
</div>

        </div>
        </motion.div>
  )
}

export default Description
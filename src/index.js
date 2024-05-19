import dotenv from 'dotenv'
import connectDB from './db/index.js'
import { app } from './app.js'

dotenv.config({
	path: './env',
})

connectDB()
	.then(() => {
		app.on('error', (error) => {
			console.log(`Error`, error)
			throw error
		})
		app.listen(process.env.PORT || 5000, () => {
			console.log(`Server is running at ${process.env.PORT}`)
		})
	})
	.catch((error) => {
		console.log('MongoDB Connection Failed !!', error)
	})

/* 
! Database connection Code
import express from 'express'
const app = express()

( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
        app.on('error', (error) => {
            console.log('Error: ', error)
            throw error
        })
        app.listen(process.env.PORT, () => {
            console.log('App is Listening')
        })
    } catch (error) {
        console.log("Error: ", error)
        throw error
    }
})()
*/

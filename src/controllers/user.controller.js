import { asyncHandler } from "../utils/asyncHandler.js";

const registerUser = asyncHandler( async (req, res) => {
   // get user details from frontend
   // validation - not empty
   // check user is already exit. username, email
   // check for images, check for avatar
   // upload them to cloudinary, avatar
   // create user object - create entry in db
   // remove password and refresh token field from response
   // check for user creation 
   // return response

    const {email, username, password, fullName} = req.body
    console.log(email)

})

export {registerUser}
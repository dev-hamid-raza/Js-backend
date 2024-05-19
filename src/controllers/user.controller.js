import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { User } from '../models/user.model.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/ApiResponse.js'

const registerUser = asyncHandler(async (req, res) => {
	// get user details from frontend
	// validation - not empty
	// check user is already exit. username, email
	// check for images, check for avatar
	// upload them to cloudinary, avatar
	// create user object - create entry in db
	// remove password and refresh token field from response
	// check for user creation
	// return response

	const { email, username, password, fullName } = req.body

	// if(fullName === '') {
	//     throw new ApiError(400, 'Full is required')
	// }

	if (
		[email, username, password, fullName].some((field) => field?.trim === '')
	) {
		throw new ApiError(400, 'All fields are required')
	}
	const userExist = User.findOne({
		$or: [{ username }, { email }],
	})
	if (userExist) {
		throw new ApiError(409, 'User is already exist')
	}
	const avatarLocalPath = req.files?.avatar[0]?.path
	const coverImageLocalPath = req.files?.coverImage[0]?.path

	if (!avatarLocalPath) {
		throw new ApiError(400, 'avatar is required')
	}

	const avatar = await uploadOnCloudinary(avatarLocalPath)
	const coverImage = await uploadOnCloudinary(coverImageLocalPath)

	if (!avatar) {
		throw new ApiError(400, 'avatar is required')
	}

	const user = await User.create({
		email,
		password,
		fullName,
		username: username.toLowerCase(),
		avatar: avatar.url,
		coverImage: coverImage?.url,
	})

	const createdUser = await User.findById(user._id).select(
		'-password -refreshToken'
	)

	if (!createdUser) {
		throw new ApiError(500, 'Something want wrong while register the user')
	}

	return res
		.status(200)
		.json(new ApiResponse(200, createdUser, 'User is Created'))
})

export { registerUser }

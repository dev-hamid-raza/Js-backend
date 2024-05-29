import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { User } from '../models/user.model.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/ApiResponse.js'

const generateRefreshAndAccessToken = async(userId) => {
	try {
		const user = await User.findById(userId)
		const accessToken = user.generateAccessToken()
		const refreshToken = user.generateRefreshToken()

		user.accessToken = accessToken
		await user.save({validateBeforeSave: false})

		return {accessToken, refreshToken}
	} catch (error) {
		throw new ApiError(500, 'Something went wrong while refresh and access token')
	}
}

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
	const userExist = await User.findOne({
		$or: [{ username }, { email }],
	})
	if (userExist) {
		throw new ApiError(409, 'User is already exist')
	}
	const avatarLocalPath = req.files?.avatar[0]?.path
	// const coverImageLocalPath = req.files?.coverImage[0]?.path

	let coverImageLocalPath
	if (
		req.files &&
		Array.isArray(req.files.coverImage) &&
		req.files.coverImage.length > 0
	) {
		coverImageLocalPath = req.files.coverImage[0].path
	}

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
		.status(201)
		.json(new ApiResponse(200, createdUser, 'User is Created'))
})

const loginUser = asyncHandler(async (req, res) => {
	// req body -> data
	// username or email
	// find the user
	// password check
	// access and refresh token
	// send cookie

	const { email, username, password } = req.body

	if (!(email || username)) {
		throw new ApiError(400, 'username or email is required')
	}

	const user = await User.findOne({
		$or: [{ username }, { email }],
	})

	if(!user) {
		throw new ApiError(400, 'User is not found')
	}

	const isPasswordValid = await user.isPasswordCorrect(password)

	if(!isPasswordValid) {
		throw new ApiError(401, 'Password is inCorrect')
	}

	const {accessToken, refreshToken} = await generateRefreshAndAccessToken(user._id)

	const loggedInUser = await User.findById(user._id).select('-password -accessToken')

	const options = {
		httpOnly: true,
		secure: true
	}
	return res
	.status(200)
	.cookie('accessToken', accessToken, options)
	.cookie('refreshToken', refreshToken, options)
	.json(
		new ApiResponse(
			200,
			{
				user: loggedInUser,accessToken, refreshToken
			},
			'User loggedIn successfully'
		)
	)
})

const logoutUser = asyncHandler(async (req, res) => {
	await User.findByIdAndUpdate(
		req.user._id,
		{
			$set: {refreshToken: undefined}
		},
		{
			new: true
		}
	)

	const options = {
		httpOnly: true,
		secure: true
	}
	res
	.status(200)
	.clearCookie('accessToken', options)
	.clearCookie('refreshToken', options)
	.json(new ApiResponse(200, {}, 'User logged out'))
})

export { registerUser, loginUser, logoutUser }

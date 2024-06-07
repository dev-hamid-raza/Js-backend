import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { User } from '../models/user.model.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import jwt from 'jsonwebtoken'

const generateRefreshAndAccessToken = async (userId) => {
	try {
		const user = await User.findById(userId)
		const accessToken = user.generateAccessToken()
		const refreshToken = user.generateRefreshToken()

		user.accessToken = accessToken
		await user.save({ validateBeforeSave: false })

		return { accessToken, refreshToken }
	} catch (error) {
		throw new ApiError(
			500,
			'Something went wrong while refresh and access token'
		)
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

	if (!user) {
		throw new ApiError(400, 'User is not found')
	}

	const isPasswordValid = await user.isPasswordCorrect(password)

	if (!isPasswordValid) {
		throw new ApiError(401, 'Password is inCorrect')
	}

	const { accessToken, refreshToken } = await generateRefreshAndAccessToken(
		user._id
	)

	const loggedInUser = await User.findById(user._id).select(
		'-password -accessToken'
	)

	const options = {
		httpOnly: true,
		secure: true,
	}
	return res
		.status(200)
		.cookie('accessToken', accessToken, options)
		.cookie('refreshToken', refreshToken, options)
		.json(
			new ApiResponse(
				200,
				{
					user: loggedInUser,
					accessToken,
					refreshToken,
				},
				'User loggedIn successfully'
			)
		)
})

const logoutUser = asyncHandler(async (req, res) => {
	await User.findByIdAndUpdate(
		req.user._id,
		{
			$set: { refreshToken: undefined },
		},
		{
			new: true,
		}
	)

	const options = {
		httpOnly: true,
		secure: true,
	}
	res
		.status(200)
		.clearCookie('accessToken', options)
		.clearCookie('refreshToken', options)
		.json(new ApiResponse(200, {}, 'User logged out'))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
	const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

	if (!incomingRefreshToken) {
		throw new ApiError(401, 'Unauthorized access')
	}

	try {
		const decodedToken = jwt.verify(
			incomingRefreshToken,
			process.env.REFRESH_TOKEN_SECRET
		)
	
		const user = await User.findById(decodedToken?._id)
	
		if (!user) {
			throw new ApiError(401, 'Invalid refresh token')
		}
	
		if (incomingRefreshToken !== user.refreshToken) {
			throw new ApiError(401, 'Refresh token is expired or used')
		}
	
		const options = {
			httpOnly: true,
			secure: true,
		}
		const { accessToken, newRefreshToken } = await generateRefreshAndAccessToken(
			user._id
		)
	
		return res
			.status(200)
			.cookie('accessToken', accessToken, options)
			.cookie('refreshToken', newRefreshToken, options)
			.json(
				new ApiResponse(
					200,
					{ accessToken, refreshToken: newRefreshToken },
					'Access token refreshed successfully'
				)
			)
	} catch (error) {
		throw new ApiError(401, error?.message || 'Invalid refresh token')
	}
})

const changeCurrentPassword = asyncHandler(async(req, res) => {
	const { oldPassword, newPassword} = req.body

	const user = await User.findById(req.user?._id)

	const isPasswordIsCorrect = await user.isPasswordCorrect(oldPassword)

	if(!isPasswordIsCorrect) {
			throw new ApiError(400, 'Invalid Old Password')
	}

	user.password = newPassword

	await user.save({validateBeforeSave: false})

	return res
	.status(200)
	.json(new ApiResponse(200, {}, 'Password is Changed successfully'))
})


const getCurrentUser = asyncHandler(async (req, res) => {
	return res
	.status(200)
	.json( new ApiResponse(200, req.user, 'Current user fetched successfully'))
})

const updateAccountDetails = asyncHandler(async (req, res) => {
	const {fullName, email} = req.body

	if( !fullName || !email) {
		throw new ApiError(400,'All files are required')
	}

	const user = await User.findByIdAndDelete(
		req.user?._id,
		{
			$set: {
				fullName,
				email
			}
		},
		{new: true}
	).select('-password')

	return res
			.status(200)
			.json(new ApiResponse(200, user, 'User update successfully'))
})

const updateUserAvatar = asyncHandler(async (req, res) =>{
	const avatarLocalPath = req.file?.path

	if(!avatarLocalPath) {
		throw new ApiError(400, 'avatar is required')
	}

	const avatar = await uploadOnCloudinary(avatarLocalPath)

	if(!avatar.url) {
		throw new ApiError(400,'error while uploading on cloudinary')
	}

	const user = await User.findByIdAndUpdate(
		req.user?._id,
		{
			$set: {
				avatar: avatar.url
			}
		},
		{new: true}
	).select('-password')
	res
	.status(200)
	.json(new ApiResponse(200, user, 'Avatar update successfully'))
})

const updateUserCoverImage = asyncHandler(async (req, res) =>{
	const avatarLocalPath = req.file?.path

	if(!coverImageLocalPath) {
		throw new ApiError(400, 'coverImage is required')
	}

	const coverImage = await uploadOnCloudinary(coverImageLocalPath)

	if(!coverImage.url) {
		throw new ApiError(400,'error while uploading on cloudinary')
	}

	const user = await User.findByIdAndUpdate(
		req.user?._id,
		{
			$set: {
				coverImage: coverImage.url
			}
		},
		{new: true}
	).select('-password')
	res
	.status(200)
	.json(new ApiResponse(200, user, 'Cover image update successfully'))
})

export { 
	registerUser, 
	loginUser, 
	logoutUser, 
	refreshAccessToken, 
	changeCurrentPassword, 
	getCurrentUser,
	updateAccountDetails,
	updateUserAvatar,
	updateUserCoverImage
}

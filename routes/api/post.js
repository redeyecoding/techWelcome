const mongoose = require('mongoose');
const auth = require('../../middleware/auth');
const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const User = require('../../models/User');
const Post = require('../../models/Post');
const Profile = require('../../models/Profile');


// POST /api/posts
// Add a post 
// @Private
router.post('/', [
    auth,
    check('text', 'Text is required to create a post.')
        .not()
        .isEmpty()
    ], async(req, res)=> {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    };

    try {
        const user = await User.findById(req.user.id).select('-password');

        const newPost = new Post({
            text: req.body.text,
            name: user.name,
            avatar: user.avatar,
            user: req.user.id
        });
        const post = await newPost.save();
        res.json(post);

    } catch (err) {
        console.error(err.message);
        return res.status(500).send('Server Error');
    };

});

// @route GET api/posts
// @desc Get all posts
// @access Private
router.get('/', auth, async(req, res)=> {
    try{
        const posts = await Post.find({}).sort({ date: -1 });
        res.json(posts);
    } catch(err) {
        console.error(err.message);
        return res.status(500).send('Server Error');
    };
});

// @route GET api/posts/:userID
// @desc Get post via ID
// @access Private
router.get('/myposts/:userID', auth, async(req, res) =>{
    try {
        const myPosts = await Post.find({ user: req.params.userID });
        if (!myPosts) {
            return res.status(404).json({ msg: 'Post not found' });
        };
        res.json(myPosts);

    } catch (err) {
        if (err.kind === 'ObjectId') {
            console.error(err.message);
            return res.status(404).json({ msg: 'Post not found' });
        };
    };
});


// @route DELETE api/posts/:userID
// @desc Delete a single post via ID
// @access Private
router.delete('/myposts/:postID', auth, async(req, res) =>{
    try {
        const post = await Post.findById(req.params.postID);

        // Check user
        if (post.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        };

        // Check post
        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        };

        await post.remove();
        res.json({ msg: 'Post removed' });

    } catch (err) {
        if (err.kind === 'ObjectId') {
            console.error(err.message);
            return res.status(404).json({ msg: 'Post not found' });
        };
    };
});

// @route PUT /api/post/like/:postID
// @desc  Like a post
// @access Private
router.put('/like/:postID', auth, async(req, res) => {
    try {
        const post = await Post.findById(req.params.postID);

        // Check if post liked by user
        const verifyLike = (like) => like.user.toString() === req.user.id;

        if (post.likes.filter(verifyLike).length > 0) {
            return res.status(400).json({ msg: 'Post already liked' });
        };

        post.likes.unshift({ user: req.user.id });
        await post.save();
        res.json(post.likes);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route PUT /api/post/like/:postID
// @desc  UnLike a post
// @access Private
router.put('/unlike/:postID', auth, async(req, res) => {
    try {
        const post =  await Post.findById(req.params.postID);

        // Check if post liked by user        
        if (post.likes.filter(like => like.user.toString() === req.user.id ).length === 0) {
            return res.status(400).json({ msg: 'You must, first, like the post before you can remove it' });
        };
        
        // Remove user post like
        const userLike = post.likes.find(likedId => req.user.id);
        const likeIndex = post.likes.indexOf(userLike);
        post.likes.splice(likeIndex, 1);

        await post.save();

        res.json(post.likes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// @route POST /api/post/comment/:postID
// @desc  Post a comment
// @access Private
router.post('/comment/:postID', [ auth,
    check('text', 'Text is required')
        .not()
        .isEmpty()
    ], async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() })
        }; 
        
        try {
            const post = await Post.findById(req.params.postID);        
            const user = await User.findById(req.user.id).select(['-email','-password']);

            // Build Comments object
            const newComment = {
                user: req.user.id,
                name: user.name,
                text: req.body.text,
                avatar: user.avatar
            };

            post.comments.unshift(newComment);
            await post.save();

            res.json(post.comments);
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server Error');
        };
    });

    
    // @route DELETE /api/post/delete_comment/:postID
    // @desc Delete a comment from post
    // @access Private
    router.delete('/delete_comment/:postID/:comment_id', auth, async(req, res) => {
         try {
            // Pull comment and post.
            const [ post, commentId ] = [
                await Post.findById(req.params.postID),
                req.params.comment_id
            ];

            const userComment = post.comments.find(comment => comment.id === commentId);
            const user = await User.findById(req.user.id);

            // Check if comment exists
            if (!userComment) {
                return res.status(404).json({ msg: 'Comment does not exist' });
            };

            const ownerOfPost = post.user.toString();
            const ownerOfComment = userComment.user.toString();

            // Only the owner of the post and owner of comment should have ability
            // to delete a comment
            if (ownerOfPost !== user.id && ownerOfComment !== req.user.id)  {
                return res.status(401).json({ msg: 'User not authorized' });
            };

            const commentIndex = post.comments
                .map(comment => comment)
                .indexOf(userComment);

            post.comments.splice(commentIndex, 1);

            await post.save();

            res.json(post.comments);
        } catch (err) {
            if (err.kind === 'ObjectId' || err.value === postID) {
                console.error(err.message);
                res.status(404).json({ msg: 'Comment does not exist' });
            } else {
                console.error(err.message);
                res.status(500).send('Server Error');
            };
        };
    });

    


module.exports = router;
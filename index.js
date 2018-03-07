var rp = require('request-promise');
var server = require('http').createServer();
var io = require('socket.io')(server);

server.listen(3000);
io.on('connection', function(socket){
	//User
	socket.emit('connected', true);
	console.log('User Connected');

	socket.on('disconnect', function(){
		console.log('Ended connection');
	});

	socket.on('auth player', function(data) {
		socket.emit('player', trivia.authPlayer(data));
		trivia.gameInProgress();
		console.log(trivia.players);
	});

	socket.on('add player', function(data){
		trivia.addPlayer(data);
		trivia.gameInProgress();
	});

	socket.on('message', function(data){
		trivia.listen(data, socket.id);
	})
});

class Trivia {
	constructor() {
		console.log('[!] Trivia App is running!');
		this.inProgress = false;
		this.players = {};
		this.playerCount = 0; // count of total players joined, not active players
		this.activePlayerCount = 0; // count of players currently connected
		this.winningSocket = null;
		this.questions;
		this.activeQuestion;
		this.apOptions = {
			uri: Trivia.TRIVIA_URL,
			headers: {
				'User-Agent': 'Request-Promise'
			},
			json: true
		};
	}

	static get TRIVIA_URL() {
		//Possible variations >> https://opentdb.com/api.php?amount=10&difficulty=easy&type=boolean
		return 'https://opentdb.com/api.php?amount=10';
	}

	static get MAX_NAME_LENGTH() {
		return 22;
	}

	getQuestions() {
		rp(this.apOptions)
			.then((resp) => {
				this.questions = resp.results;
				this.askQuestion();
			})
			.catch(function (err) {
				console.log(err);
			});
	}

	addPlayer(player) {
		this.playerCount++;
		this.players[player.id] = {
			id: player.id,
			createdTime: new Date().getTime(),
			lastActiveTime: new Date().getTime(),
			lastWinTime: 0,
			clientIp: player.clientIp || '',
			points: 0,
			origName: player.name,
			name: this.normalizePlayerName(player.name) || 'Player_' + this.playerCount
		}
		return this.players[player.id];
	}

	authPlayer(player) {
		console.log("[!] authPlayer");
		if(this.players[player.id] === undefined) {
			return this.addPlayer(player);
		} else {
			return this.players[player.id];
		}
	}

	normalizePlayerName(name) {
		name = name || '';
		name = name.trim().replace(/\s+/g,'_');
		name = name.replace(/\W/g,'');
		if (name.length > this.MAX_NAME_LENGTH) {
			name = name.substring(0,this.MAX_NAME_LENGTH-1) + '_';
		}
		return name;
	}

	listen(data, socketID) {
		console.log("Listen: " + data);
		if(this.inProgress === true) {
			this.answer(data);
		} else {
			if(data.msg === 'play') {
				this.play();
			} else {

			}
		}
	}

	answer(data) {
		console.log('Answer: '+data.msg);
		if(data.msg.toUpperCase() == this.activeQuestion.correct_answer.toUpperCase()) {
			io.emit('answer correct', 'Correct!');
			this.answerCleanup(data.player);
		} else {
			io.emit('answer incorrect', 'Sorry :(!');
			console.log(this.activeQuestion);
		}
	}

	answerCleanup(player) {
		this.players[player.id].points += 5;
	}

	play() {
		console.log('Game is trying to start.');
		if(this.inProgress === false) {
			this.startGame();
		} else {
			io.emit('error', {
				type : 'err',
				msg : 'Game is already in progress, you idiot!'
			});
		}
	}

	startGame() {
		this.inProgress = true;
		this.getQuestions();
	}

	askQuestion() {
		if(this.questions.length == 0) {
			console.log('No Questions');
			return false;
		}
		this.activeQuestion = this.questions[0];
		io.emit('ask question', this.activeQuestion);
		console.log('Message dispatched!');
	}

	gameInProgress() {
		console.log("[!] Game in progress?: "+this.inProgress);
		if(this.inProgress === true) {
			this.askQuestion();
		}
	}
}

var trivia = new Trivia();

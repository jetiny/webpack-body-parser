/*!
 * body-parser
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var bytes = require('bytes')
var read = require('../read')
var typer = require('media-typer')
var typeis = require('type-is')

/**
 * Module exports.
 */

module.exports = urlencoded

/**
 * Cache of parser modules.
 */

var parsers = Object.create(null)

/**
 * Create a middleware to parse urlencoded bodies.
 *
 * @param {object} [options]
 * @return {function}
 * @api public
 */

function urlencoded(options){
  options = options || {};

  // notice because option default will flip in next major
  if (options.extended === undefined) {
    //@FIXME Deprecate('undefined extended: provide extended option')
  }

  var extended = options.extended !== false
  var inflate = options.inflate !== false
  var limit = typeof options.limit !== 'number'
    ? bytes(options.limit || '100kb')
    : options.limit
  var type = options.type || 'urlencoded'
  var verify = options.verify || false

  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function')
  }

  var queryparse = extended
    ? extendedparser(options)
    : simpleparser(options)

  function parse(body) {
    return body.length
      ? queryparse(body)
      : {}
  }

  return function urlencodedParser(req, res, next) {
    if (req._body) return next();
    req.body = req.body || {}

    if (!typeis(req, type)) return next();

    var charset = (typer.parse(req).parameters.charset || 'utf-8').toLowerCase()
    if (charset !== 'utf-8') {
      var err = new Error('unsupported charset "' + charset.toUpperCase() + '"')
      err.charset = charset
      err.status = 415
      next(err)
      return
    }

    // read
    read(req, res, next, parse, {
      encoding: charset,
      inflate: inflate,
      limit: limit,
      verify: verify
    })
  }
}

/**
 * Get the extended query parser.
 *
 * @param {object} options
 */

function extendedparser(options) {
  var parameterLimit = options.parameterLimit !== undefined
    ? options.parameterLimit
    : 1000
  var parse = require('qs').parse

  if (isNaN(parameterLimit) || parameterLimit < 1) {
    throw new TypeError('option parameterLimit must be a positive number')
  }

  if (isFinite(parameterLimit)) {
    parameterLimit = parameterLimit | 0
  }

  return function queryparse(body) {
    var paramCount = parameterCount(body, parameterLimit)

    if (paramCount === undefined) {
      var err = new Error('too many parameters')
      err.status = 413
      throw err
    }

    var arrayLimit = Math.max(100, paramCount)

    return parse(body, {
      arrayLimit: arrayLimit,
      depth: Infinity,
      parameterLimit: parameterLimit
    })
  }
}

/**
 * Count the number of parameters, stopping once limit reached
 *
 * @param {string} body
 * @param {number} limit
 * @api private
 */

function parameterCount(body, limit) {
  var count = 0
  var index = 0

  while ((index = body.indexOf('&', index)) !== -1) {
    count++
    index++

    if (count === limit) {
      return undefined
    }
  }

  return count
}

/**
 * Get the simple query parser.
 *
 * @param {object} options
 */

function simpleparser(options) {
  var parameterLimit = options.parameterLimit !== undefined
    ? options.parameterLimit
    : 1000
  var parse = require('querystring').parse

  if (isNaN(parameterLimit) || parameterLimit < 1) {
    throw new TypeError('option parameterLimit must be a positive number')
  }

  if (isFinite(parameterLimit)) {
    parameterLimit = parameterLimit | 0
  }

  return function queryparse(body) {
    var paramCount = parameterCount(body, parameterLimit)

    if (paramCount === undefined) {
      var err = new Error('too many parameters')
      err.status = 413
      throw err
    }

    return parse(body, undefined, undefined, {maxKeys: parameterLimit})
  }
}

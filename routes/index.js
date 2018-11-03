const credentials = require('../credentials.json')
const Airtable = require('airtable')
let airtable = {
  apiKey: '',
  baseId: ''
}
if (process.env.NODE_ENV === 'production') {
  airtable.apiKey = process.env.AIRTABLE_API_KEY
  airtable.baseId = process.env.AIRTABLE_BASE_ID
} else {
  airtable.apiKey = credentials.airtable.apiKey
  airtable.baseId = credentials.airtable.baseId
}
const base = new Airtable({apiKey: airtable.apiKey}).base(airtable.baseId)
console.log(process.env.NODE_ENV)

module.exports = function (app, addon) {

    // Root route. This route will serve the `atlassian-connect.json` unless the
    // documentation url inside `atlassian-connect.json` is set
    app.get('/', function (req, res) {
        res.format({
            // If the request content-type is text-html, it will decide which to serve up
            'text/html': function () {
                res.redirect('/atlassian-connect.json');
            },
            // This logic is here to make sure that the `atlassian-connect.json` is always
            // served up when requested by the host
            'application/json': function () {
                res.redirect('/atlassian-connect.json');
            }
        });
    });
    
    app.get('/render-airtable-project-status', addon.authenticate(), function (req, res) {
      if (!req.query.projectId) {
        res.render('airtable-project-status', {
          project: {
            fields: {
              Name: 'No Project Selected'
            }
          }
        })
      } else {
        base('Projects').find(req.query.projectId, function(err, record) {
          if (err) { console.error(err); return; }
          let latestStatus = record.get('Latest Status') ? record.get('Latest Status')[0] : ''
          console.log(record.get('Latest Status')[0])
          switch(latestStatus) {
            case 'Green':
              record.messageStyle = 'success'
              record.statusStyle = 'success'
              break
            case 'Yellow':
              record.messageStyle = 'warning'
              record.statusStyle = 'moved'
              break
            case 'Red':
              record.messageStyle = 'error'
              record.statusStyle = 'error'
              break
            case 'Planning':
              record.messageStyle = 'info'
              record.statusStyle = 'current aui-lozenge-subtle'
            case 'Blocked Internal':
              record.messageStyle = 'info'
              record.statusStyle = 'current'
            case 'Blocked External':
              record.messageStyle = 'info'
              record.statusStyle = 'new'
            default:
              record.messageStyle = ''
              record.messageStyle = 'info'
          }
          console.log(record.messageStyle)
          res.render('airtable-project-status', {
            project: record
          })  
        })
      }
    })
    
    app.get('/render-airtable-project-tasks', addon.authenticate(), function (req, res) {
      if (!req.query.projectId) {
        res.render('airtable-project-status', {
          project: {
            fields: {
              Name: 'No Project Selected'
            }
          }
        })
      } else {
        let tasks = []
        base('Tasks').select({
          view: 'All Tasks',
          sort: [{field: 'Phase', direction: 'desc'}],
          filterByFormula: `FIND('${req.query.projectId}', {Project ID Lookup}, 0)`
        }).eachPage(function page(records, fetchNextPage) {
          for (const record of records) {
            switch(record.get('Status')) {
              case 'In Progress':
                record.inProgress = true
                break
              case 'Blocked':
                record.isBlocked = true
                break
              case 'Done':
                record.isDone = true
                break
            }
            tasks.push(record)
          }
          fetchNextPage()
        }, function done(err) {
          if (err) { console.error(err); return (err); }
          res.render('airtable-project-tasks', {
            tasks: tasks
          })  
        })
      }
    })
    
    app.get('/render-airtable-task', addon.authenticate(), function (req, res) {
      if (!req.query.taskId) {
        res.render('airtable-project-status', {
          task: {
            fields: {
              Name: 'No Task Selected'
            }
          }
        })
      } else {
        base('Tasks').find(req.query.taskId, function(err, record) {
          if (err) { console.error(err); return; }
          switch(record.get('Status')) {
            case 'In Progress':
              record.inProgress = true
              break
            case 'Blocked':
              record.isBlocked = true
              break
            case 'Done':
              record.isDone = true
              break
          }
          console.log(record.messageStyle)
          res.render('airtable-task', {
            task: record
          })  
        })
      }
    })
    
    app.get('/airtable-project-selector', addon.authenticate(), function (req, res) {
      res.render('airtable-project-status-selector')
    })
    
    app.get('/airtable-task-selector', addon.authenticate(), function (req, res) {
      res.render('airtable-task-selector')
    })
    
    app.get('/search/project', function (req, res) {
      res.setHeader('Content-Type', 'application/json');
      let recordsToReturn = []
      let projectRetrievalOptions = {
        view: 'All Projects',
        sort: [{field: "Name", direction: "desc"}]
      }
      if (req.query.q) {
        projectRetrievalOptions.filterByFormula = `FIND(UPPER("${req.query.q}"), UPPER({Name}), 0)`
      }
      base('Projects').select(projectRetrievalOptions).eachPage(function page(records, fetchNextPage) {
        records.forEach(record => {
          recordsToReturn.push({
            label: record.get('Name'),
            value: record.id
          })
        })
        fetchNextPage()
      }, function done(err) {
        if (err) { console.error(err); return (err); }
        console.log(JSON.stringify(recordsToReturn))
        res.send(JSON.stringify(recordsToReturn))
      })
    })
    
    app.get('/search/task', function (req, res) {
      res.setHeader('Content-Type', 'application/json');
      let recordsToReturn = []
      let taskRetrievalOptions = {
        view: 'All Tasks',
        sort: [{field: "Name", direction: "desc"}]
      }
      if (req.query.q) {
        taskRetrievalOptions.filterByFormula = `FIND(UPPER("${req.query.q}"), UPPER({Name}), 0)`
      }
      base('Tasks').select(taskRetrievalOptions).eachPage(function page(records, fetchNextPage) {
        for (const record of records) {
          recordsToReturn.push({
            label: record.get('Name'),
            value: record.id
          })
        }
        fetchNextPage()
      }, function done(err) {
        if (err) { console.error(err); return (err); }
        res.send(JSON.stringify(recordsToReturn))
      })
    })

    // This is an example route that's used by the default "generalPage" module.
    // Verify that the incoming request is authenticated with Atlassian Connect
    app.get('/hello-world', addon.authenticate(), function (req, res) {
            // Rendering a template is easy; the `render()` method takes two params: name of template
            // and a json object to pass the context in
            res.render('hello-world', {
                title: 'Atlassian Connect'
                //issueId: req.query['issueId']
            });
        }
    );

    // Add any additional route handlers you need for views or REST resources here...


    // load any additional files you have in routes and apply those to the app
    {
        var fs = require('fs');
        var path = require('path');
        var files = fs.readdirSync("routes");
        for(var index in files) {
            var file = files[index];
            if (file === "index.js") continue;
            // skip non-javascript files
            if (path.extname(file) != ".js") continue;

            var routes = require("./" + path.basename(file));

            if (typeof routes === "function") {
                routes(app, addon);
            }
        }
    }
};

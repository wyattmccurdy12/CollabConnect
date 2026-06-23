# Collab Connect Frontend

This frontend provides a user-friendly experience to help users connect with industry professionals.

## Running the Frontend

The frontend runs exclusively via Docker Compose. See the [main README](../README.md) for setup instructions.

To start development:

```bash
cd .. && docker compose -f compose.dev.yaml up --build
```

The frontend will be available at http://localhost:3000/ with hot reload enabled on code changes. 

## Development Tips

There are a few components to take note of during development. 

### Page Headers

For a frontend to remain professional, consistancy is key. So, it's important to keep each page consistent with the same
style. This starts with the page header. Here is an example of what the header looks like: 

Imports:
```
import { Box } from "@mui/material";
import Header from "../../components/Header";
```

Code:
```
    <Box m="20px">
      <Box
        display="flex"
        justifyContent={"space-between"}        
        alignItems={"center"}        
      >      
        <Header title="DASHBOARD" subtitle="Welcome to your dashboard" />  
      </Box> 
    </Box>

```
**Note, this may in the future be turned into a component to allow ease of use.**

This code sample will generates this atop your page

<img width="252" height="94" alt="image" src="https://github.com/user-attachments/assets/fcbe6d39-d91b-4b20-a2c8-81398febc183" />

### Creating a new page

1.) Define Route
When creating a new page, there are two keys to do. First is to look into the App.js file. This generate all the possible frontend 
routes for CollabConnect. When creating a page, your just looking for this rough snippet of code:

```
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/search" element={<SearchCollab />} />
            </Routes>
```

Each `<Route>` takes in two parameters. The first being the route you want the page to generate on `path="/search"`,
and the second being the component that is the content of your page. `element={<SearchCollab />} ` 
So, your route will look like this `<Route path="/Your-Route-Here" element={<Your Component Here />} />`

Your route definition can be whatever you would like it to be, just remember what it is for the next step. 

2.) Add to Sidebar

The Sidebar is our primary navigator for CollabConnect. So, if a new route is defined, it needs to be added to our 
sidebar. The sidebar can be found in src -> scenes -> global -> Sidebar.jsx

There are two things to update here. The first is found at the top of the file. It is a useEffect 
that enables proper sidebar management. So, if a user starts the application at /search, 
the UI will know to highlight Search Collaberators. The code you are looking for looks like this

```
    useEffect(() => {
    const pathToMenu = {
      "/search": "Search Collaberators",
      "/": "Dashboard",
    };
```

Add in your defined route path here, and map it to the title you want to give your page. 

Afterwards, you need to create your sidebar item. Look for this comment found deeper in the code:
`  {/* DEFINE YOUR ROUTE PUSHES HERE  */}`, which states where the route definitions begin in the sidebar. 

Each one is defined in an Item, which will look like this:

```
            <Item
              title="Manage Connections"
              to="/connections"
              icon={<PeopleOutlinedIcon />}
              selected={selected}
              setSelected={setSelected}
            />
```

In this case, the item above generates the following side bar item, which pushes to /connections when clicked. 

<img width="188" height="34" alt="image" src="https://github.com/user-attachments/assets/194b8d75-b6e5-4f57-aeaf-2458dce65f99" />


So, to define your new item, fill in the title, route you picked for your page, and the icon you want to appear. The icons we are using 
come from the website https://mui.com/material-ui/material-icons/?query=search This website allows you to search for the icon you would 
like to use. Once you pick an icon from the website, the website will give you the import you need to use to use the icon which can be 
defined atop the page. 

Once these two steps are fully complete and saved, your icon should appear on the sidebar, and when clicked it will take you to your page.





